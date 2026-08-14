import { beforeAll, describe, expect, test } from "bun:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import {
  getAppleNotificationAudiences,
  parseAppleNotificationRequestBody,
  verifyAppleNotification,
} from "../convex/lib/appleNotification.ts";

const now = new Date("2026-08-13T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1_000);
let privateKey: CryptoKey;
let localKeySet: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  privateKey = keys.privateKey;
  const publicJwk: JWK = {
    ...(await exportJWK(keys.publicKey)),
    alg: "RS256",
    kid: "apple-test-key",
    use: "sig",
  };
  localKeySet = createLocalJWKSet({ keys: [publicJwk] });
});

describe("Apple account-change notifications", () => {
  test("verifies Apple claims and parses a stringified event", async () => {
    const token = await signNotification({
      events: JSON.stringify({
        event_time: now.getTime(),
        sub: "apple-user-123",
        type: "consent-revoked",
      }),
      jti: "event-123",
    });

    await expect(
      verifyAppleNotification(token, {
        audiences: ["sh.wrapper.mobile"],
        currentDate: now,
        key: localKeySet,
      }),
    ).resolves.toEqual({
      events: [
        {
          eventTime: now.getTime(),
          sub: "apple-user-123",
          type: "consent-revoked",
        },
      ],
      jti: "event-123",
    });
  });

  test("accepts bounded event arrays and optional email fields", async () => {
    const token = await signNotification({
      events: [
        {
          email: "relay@privaterelay.appleid.com",
          is_private_email: true,
          sub: "apple-user-123",
          type: "email-disabled",
        },
        {
          sub: "apple-user-456",
          type: "account-deleted",
        },
      ],
      jti: "event-array",
    });

    const result = await verifyAppleNotification(token, {
      audiences: ["sh.wrapper.mobile"],
      currentDate: now,
      key: localKeySet,
    });
    expect(result.events).toEqual([
      {
        email: "relay@privaterelay.appleid.com",
        isPrivateEmail: true,
        sub: "apple-user-123",
        type: "email-disabled",
      },
      {
        sub: "apple-user-456",
        type: "account-deleted",
      },
    ]);
  });

  test("rejects the wrong audience, issuer, and malformed events", async () => {
    const wrongAudience = await signNotification({
      audience: "attacker.example",
      events: { sub: "apple-user-123", type: "consent-revoked" },
      jti: "wrong-audience",
    });
    await expect(
      verifyAppleNotification(wrongAudience, {
        audiences: ["sh.wrapper.mobile"],
        currentDate: now,
        key: localKeySet,
      }),
    ).rejects.toThrow();

    const wrongIssuer = await signNotification({
      events: { sub: "apple-user-123", type: "consent-revoked" },
      issuer: "https://attacker.example",
      jti: "wrong-issuer",
    });
    await expect(
      verifyAppleNotification(wrongIssuer, {
        audiences: ["sh.wrapper.mobile"],
        currentDate: now,
        key: localKeySet,
      }),
    ).rejects.toThrow();

    const malformedEvents = await signNotification({
      events: { sub: "", type: "consent-revoked" },
      jti: "malformed-events",
    });
    await expect(
      verifyAppleNotification(malformedEvents, {
        audiences: ["sh.wrapper.mobile"],
        currentDate: now,
        key: localKeySet,
      }),
    ).rejects.toThrow("event identity");
  });

  test("validates request bodies and configured audiences", () => {
    expect(parseAppleNotificationRequestBody({ payload: "header.payload.signature" })).toBe(
      "header.payload.signature",
    );
    expect(() => parseAppleNotificationRequestBody({ payload: "" })).toThrow();
    expect(() => parseAppleNotificationRequestBody({ signedPayload: "token" })).toThrow();
    expect(
      getAppleNotificationAudiences({
        APPLE_NOTIFICATION_AUDIENCES: "sh.wrapper.mobile, sh.wrapper.web,sh.wrapper.mobile",
      }),
    ).toEqual(["sh.wrapper.mobile", "sh.wrapper.web"]);
    expect(getAppleNotificationAudiences({ APPLE_CLIENT_ID: "sh.wrapper.web" })).toEqual([]);
  });
});

async function signNotification(input: {
  audience?: string;
  events: unknown;
  issuer?: string;
  jti: string;
}): Promise<string> {
  return await new SignJWT({ events: input.events })
    .setProtectedHeader({ alg: "RS256", kid: "apple-test-key" })
    .setIssuer(input.issuer ?? "https://appleid.apple.com")
    .setAudience(input.audience ?? "sh.wrapper.mobile")
    .setJti(input.jti)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 5 * 60)
    .sign(privateKey);
}
