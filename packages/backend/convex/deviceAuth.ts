import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { protectedMutation } from "./lib/middleware";
import { enforceRateLimit } from "./lib/rateLimit";

const siteUrl =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://www.wrapper.sh");

const cleanupExpiredDeviceCodesRef = (
  components.betterAuth as unknown as {
    deviceAuth: {
      cleanupExpiredDeviceCodes: FunctionReference<
        "mutation",
        "internal",
        Record<string, never>,
        { deleted: number; hasMore: boolean },
        "betterAuth"
      >;
    };
  }
).deviceAuth.cleanupExpiredDeviceCodes;

export const requestDeviceCode = mutation({
  args: {
    clientId: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Throttle unauthenticated issuance to prevent storage/abuse flooding:
    // a per-client window plus a global ceiling. Keys stay low-cardinality.
    await enforceRateLimit(ctx, `requestDeviceCode:client:${args.clientId ?? "anon"}`, {
      limit: 10,
      windowMs: 60_000,
    });
    await enforceRateLimit(ctx, "requestDeviceCode:global", {
      limit: 120,
      windowMs: 60_000,
    });

    const result = await ctx.runMutation(components.betterAuth.deviceAuth.requestDeviceCode, {
      clientId: args.clientId,
      scope: args.scope,
    });

    const verificationUri = `${siteUrl}/oauth/authorize`;

    return {
      device_code: result.device_code,
      user_code: result.user_code,
      verification_uri: verificationUri,
      verification_uri_complete: `${verificationUri}?user_code=${result.user_code}`,
      expires_in: result.expires_in,
      interval: result.interval,
    };
  },
});

export const pollDeviceToken = mutation({
  args: {
    device_code: v.string(),
  },
  handler: async (ctx, args) => {
    // Global poll ceiling caps flooding; per-code pacing is enforced by the
    // Better Auth `interval`/`slow_down` contract the CLI already honours.
    await enforceRateLimit(ctx, "pollDeviceToken:global", {
      limit: 600,
      windowMs: 60_000,
    });

    const result = await ctx.runMutation(components.betterAuth.deviceAuth.pollDeviceToken, {
      device_code: args.device_code,
    });
    if ("error" in result) {
      return { error: result.error };
    }

    return {
      session_token: result.session_token,
      token_type: result.token_type,
      expires_in: result.expires_in,
    };
  },
});

export const getDeviceCodeInfo = mutation({
  args: {
    user_code: v.string(),
  },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "getDeviceCodeInfo:global", {
      limit: 300,
      windowMs: 60_000,
    });
    return await ctx.runQuery(components.betterAuth.deviceAuth.getDeviceCodeInfo, {
      user_code: args.user_code,
    });
  },
});

export const approveDeviceCode = protectedMutation({
  args: {
    user_code: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(components.betterAuth.deviceAuth.approveDeviceCode, {
      userId: ctx.userId,
      user_code: args.user_code,
    });

    return { success: true };
  },
});

export const denyDeviceCode = protectedMutation({
  args: {
    user_code: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(components.betterAuth.deviceAuth.denyDeviceCode, {
      user_code: args.user_code,
    });

    return { success: true };
  },
});

export const cleanupExpiredDeviceCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(cleanupExpiredDeviceCodesRef, {});
  },
});
