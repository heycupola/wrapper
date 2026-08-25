import { httpRouter } from "convex/server";
import { receive as receiveAppleNotification } from "./appleNotificationsHttp.ts";
import { authComponent, createAuth } from "./auth";
import { type AutumnWebhookEvent, handleAutumnWebhookEvent } from "./autumnWebhook.ts";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createLogger } from "./lib/logger.ts";
import { verifySvixSignature } from "./lib/svix.ts";
import { EmailKind } from "./lib/types.ts";

const autumnLog = createLogger("autumnWebhook");
const resendLog = createLogger("resendWebhook");

const http = httpRouter();

http.route({
  path: "/api/auth/apple/notifications",
  method: "POST",
  handler: receiveAppleNotification,
});

export const AUTUMN_WEBHOOK_SECRET = process.env.AUTUMN_WEBHOOK_SECRET;
export const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

http.route({
  path: "/webhook/autumn",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    const rawPayload = await request.text();

    if (!AUTUMN_WEBHOOK_SECRET) {
      autumnLog.error("AUTUMN_WEBHOOK_SECRET is not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const isValid = await verifySvixSignature(
      rawPayload,
      {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      },
      AUTUMN_WEBHOOK_SECRET,
    );

    if (!isValid) {
      autumnLog.error("Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    if (!svixId) {
      autumnLog.error("Missing svix-id header");
      return new Response("Missing event ID", { status: 400 });
    }

    const { claimed } = await ctx.runMutation(internal.webhook._claimEvent, {
      eventId: svixId,
      source: "autumn",
    });
    if (!claimed) {
      autumnLog.info("Event already processed, skipping", { svixId });
      return new Response("Already processed", { status: 200 });
    }

    try {
      const payload = JSON.parse(rawPayload) as AutumnWebhookEvent;
      autumnLog.info("Event received", {
        type: payload.type,
        scenario: payload.data?.scenario,
        svixId,
      });

      await handleAutumnWebhookEvent(ctx, payload);
    } catch (error) {
      await ctx.runMutation(internal.webhook._releaseClaim, {
        eventId: svixId,
        source: "autumn",
      });
      autumnLog.error("Error handling webhook", { error: String(error) });
      return new Response("Webhook handler error", { status: 500 });
    }

    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/webhook/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    const rawPayload = await request.text();

    if (!RESEND_WEBHOOK_SECRET) {
      resendLog.error("RESEND_WEBHOOK_SECRET is not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const isValid = await verifySvixSignature(
      rawPayload,
      {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      },
      RESEND_WEBHOOK_SECRET,
    );

    if (!isValid) {
      resendLog.error("Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    if (!svixId) {
      resendLog.error("Missing svix-id header");
      return new Response("Missing event ID", { status: 400 });
    }

    const { claimed } = await ctx.runMutation(internal.webhook._claimEvent, {
      eventId: svixId,
      source: "resend",
    });
    if (!claimed) {
      resendLog.info("Event already processed, skipping", { svixId });
      return new Response("Already processed", { status: 200 });
    }

    try {
      const payload = JSON.parse(rawPayload) as {
        type: string;
        data?: {
          email_id?: string;
          tags?: Record<string, string>;
        };
      };

      const eventType = payload.type;
      resendLog.info("Event received", { eventType, svixId });

      if (eventType === "email.delivered") {
        const tags = payload.data?.tags || {};
        const userId = tags.userId;
        const emailKind = tags.kind as EmailKind;
        const emailId = tags.emailId;

        if (userId && emailKind && emailKind !== EmailKind.AccountDeleted) {
          await ctx.runMutation(internal.user._handleEmailDelivered, {
            userId,
            emailKind,
            emailId: emailId || payload.data?.email_id || "",
            deliveredAt: Date.now(),
          });
        }
      }

      if (eventType === "email.bounced" || eventType === "email.delivery_delayed") {
        const tags = payload.data?.tags || {};
        const userId = tags.userId;
        const emailKind = tags.kind as EmailKind;

        if (userId && emailKind) {
          await ctx.runMutation(internal.user._handleEmailFailed, {
            userId,
            emailKind,
            reason: eventType,
            failedAt: Date.now(),
          });
        }
      }

      return new Response(null, { status: 200 });
    } catch (error) {
      await ctx.runMutation(internal.webhook._releaseClaim, {
        eventId: svixId,
        source: "resend",
      });
      resendLog.error("Error handling webhook", { error: String(error) });
      return new Response("Webhook handler error", { status: 500 });
    }
  }),
});

authComponent.registerRoutes(http, createAuth);

export default http;
