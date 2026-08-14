import { errors as joseErrors } from "jose";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  getAppleNotificationAudiences,
  parseAppleNotificationRequestBody,
  verifyAppleNotification,
} from "./lib/appleNotification.ts";
import { createLogger } from "./lib/logger.ts";

const log = createLogger("apple-notifications-http");
const MAX_REQUEST_BYTES = 64 * 1024;
const processAccountEventRef = internal.appleNotifications.processAccountEvent;

export const receive = httpAction(async (ctx, request) => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return errorResponse(415, "Expected application/json");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, "Request body is too large");
  }

  let bodyText: string;
  try {
    bodyText = await readLimitedBody(request, MAX_REQUEST_BYTES);
  } catch {
    return errorResponse(413, "Request body is too large");
  }

  let token: string;
  try {
    token = parseAppleNotificationRequestBody(JSON.parse(bodyText) as unknown);
  } catch {
    return errorResponse(400, "Invalid Apple notification body");
  }

  const audiences = getAppleNotificationAudiences();
  if (audiences.length === 0) {
    log.error("Apple notification endpoint is not configured", {
      errorCode: "apple_notification_audience_missing",
    });
    return errorResponse(503, "Apple notification processing is unavailable");
  }

  let notification;
  try {
    notification = await verifyAppleNotification(token, { audiences });
  } catch (error) {
    if (error instanceof joseErrors.JWKSTimeout || error instanceof TypeError) {
      log.error("Apple key service was unavailable", {
        errorCode: "apple_jwks_unavailable",
      });
      return errorResponse(503, "Apple notification verification is unavailable");
    }
    log.warn("Rejected an invalid Apple account-change notification");
    return errorResponse(401, "Invalid Apple notification signature");
  }

  try {
    for (const event of notification.events) {
      // Preserve Apple's event order when one token contains related account changes.
      // eslint-disable-next-line no-await-in-loop
      await ctx.runAction(processAccountEventRef, {
        event: {
          ...(event.eventTime === undefined ? {} : { eventTime: event.eventTime }),
          sub: event.sub,
          type: event.type,
        },
        jti: notification.jti,
      });
    }
  } catch {
    log.error("Apple account-change notification processing failed", {
      errorCode: "apple_notification_processing_failed",
    });
    return errorResponse(500, "Apple notification processing failed");
  }

  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
    },
  });
});

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function readLimitedBody(request: Request, maximumBytes: number): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    // Stream chunks must be consumed sequentially to enforce the byte limit.
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      void reader.cancel();
      throw new Error("Request body is too large");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(combined);
}
