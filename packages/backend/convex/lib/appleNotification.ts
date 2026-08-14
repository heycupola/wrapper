import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");
const MAX_NOTIFICATION_TOKEN_CHARACTERS = 32 * 1024;
const MAX_NOTIFICATION_EVENTS = 10;

const appleRemoteKeySet = createRemoteJWKSet(APPLE_JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1_000,
  cooldownDuration: 30_000,
  timeoutDuration: 5_000,
});

export type AppleAccountEvent = {
  email?: string;
  eventTime?: number;
  isPrivateEmail?: boolean;
  sub: string;
  type: string;
};

export type VerifiedAppleNotification = {
  events: AppleAccountEvent[];
  jti: string;
};

type AppleNotificationClaims = JWTPayload & {
  events?: unknown;
};

type AppleNotificationKey = CryptoKey | Uint8Array | JWTVerifyGetKey;

export function getAppleNotificationAudiences(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const configured = env.APPLE_NOTIFICATION_AUDIENCES ?? "";
  return [
    ...new Set(
      configured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function parseAppleNotificationRequestBody(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Apple notification body must be an object");
  }
  const payload = (value as { payload?: unknown }).payload;
  if (
    typeof payload !== "string" ||
    payload.length === 0 ||
    payload.length > MAX_NOTIFICATION_TOKEN_CHARACTERS
  ) {
    throw new Error("Apple notification payload is invalid");
  }
  return payload;
}

export async function verifyAppleNotification(
  token: string,
  options: {
    audiences: string[];
    currentDate?: Date;
    key?: AppleNotificationKey;
  },
): Promise<VerifiedAppleNotification> {
  if (options.audiences.length === 0) {
    throw new Error("Apple notification audience is not configured");
  }

  const { payload, protectedHeader } = await jwtVerify(token, options.key ?? appleRemoteKeySet, {
    algorithms: ["RS256"],
    audience: options.audiences,
    clockTolerance: 5,
    currentDate: options.currentDate,
    issuer: APPLE_ISSUER,
  });
  if (protectedHeader.alg !== "RS256" || !protectedHeader.kid) {
    throw new Error("Apple notification header is invalid");
  }

  const claims = payload as AppleNotificationClaims;
  if (typeof claims.jti !== "string" || claims.jti.length === 0 || claims.jti.length > 256) {
    throw new Error("Apple notification id is invalid");
  }
  if (
    typeof claims.iat !== "number" ||
    !Number.isSafeInteger(claims.iat) ||
    claims.iat > Math.floor((options.currentDate?.getTime() ?? Date.now()) / 1_000) + 5 * 60
  ) {
    throw new Error("Apple notification issued-at time is invalid");
  }

  return {
    events: parseEvents(claims.events),
    jti: claims.jti,
  };
}

function parseEvents(value: unknown): AppleAccountEvent[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      throw new Error("Apple notification events are invalid");
    }
  }

  const events = Array.isArray(parsed) ? parsed : [parsed];
  if (events.length === 0 || events.length > MAX_NOTIFICATION_EVENTS) {
    throw new Error("Apple notification event count is invalid");
  }
  return events.map(parseEvent);
}

function parseEvent(value: unknown): AppleAccountEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Apple notification event is invalid");
  }

  const event = value as Record<string, unknown>;
  if (
    typeof event.type !== "string" ||
    event.type.length === 0 ||
    event.type.length > 64 ||
    typeof event.sub !== "string" ||
    event.sub.length === 0 ||
    event.sub.length > 512
  ) {
    throw new Error("Apple notification event identity is invalid");
  }

  const eventTime = event.event_time;
  if (
    eventTime !== undefined &&
    (typeof eventTime !== "number" || !Number.isSafeInteger(eventTime) || eventTime < 0)
  ) {
    throw new Error("Apple notification event time is invalid");
  }
  const email = event.email;
  if (email !== undefined && (typeof email !== "string" || email.length > 320)) {
    throw new Error("Apple notification email is invalid");
  }
  const privateEmailValue = event.is_private_email;
  const isPrivateEmail =
    privateEmailValue === "true" ? true : privateEmailValue === "false" ? false : privateEmailValue;
  if (isPrivateEmail !== undefined && typeof isPrivateEmail !== "boolean") {
    throw new Error("Apple notification private-email flag is invalid");
  }

  return {
    ...(email === undefined ? {} : { email }),
    ...(eventTime === undefined ? {} : { eventTime }),
    ...(isPrivateEmail === undefined ? {} : { isPrivateEmail }),
    sub: event.sub,
    type: event.type,
  };
}
