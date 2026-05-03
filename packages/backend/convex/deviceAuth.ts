import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { protectedMutation } from "./lib/middleware";

const siteUrl =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://wrapper.sh");

export const requestDeviceCode = mutation({
  args: {
    clientId: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    const { expires_in, session_token, token_type } = await ctx.runMutation(
      components.betterAuth.deviceAuth.pollDeviceToken,
      {
        device_code: args.device_code,
      },
    );

    return {
      session_token,
      token_type,
      expires_in,
    };
  },
});

export const getDeviceCodeInfo = query({
  args: {
    user_code: v.string(),
  },
  handler: async (ctx, args) => {
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
