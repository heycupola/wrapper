import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { createError, ErrorCode } from "./lib/errors.ts";
import { protectedMutation } from "./lib/middleware.ts";
import { ErrorSeverity } from "./lib/types.ts";

const ATTENTION_DEBOUNCE_MS = 30_000;

export const registerDevice = protectedMutation({
  args: {
    token: v.string(),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
  },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (token.length < 16 || token.length > 256) {
      throw createError({
        code: ErrorCode.INVALID_ARGUMENTS,
        message: "Invalid device token",
        severity: ErrorSeverity.Low,
      });
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("devicePushToken")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: ctx.userId,
        environment: args.environment,
        updatedAt: now,
      });
      return { ok: true };
    }

    await ctx.db.insert("devicePushToken", {
      userId: ctx.userId,
      token,
      platform: "ios",
      environment: args.environment,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const unregisterDevice = protectedMutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("devicePushToken")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .first();
    if (existing && existing.userId === ctx.userId) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

/**
 * Host-only doorbell. Payload is a session id and a kind. Terminal bytes never
 * enter this mutation or the resulting push.
 */
export const reportAttention = protectedMutation({
  args: {
    sessionId: v.string(),
    kind: v.union(v.literal("bell"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!session || session.ownerUserId !== ctx.userId || session.status !== "active") {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Session not found",
        severity: ErrorSeverity.Low,
      });
    }

    const now = Date.now();
    if (session.lastAttentionAt && now - session.lastAttentionAt < ATTENTION_DEBOUNCE_MS) {
      return { ok: true, sent: false };
    }

    await ctx.db.patch(session._id, { lastAttentionAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.pushActions.dispatchAttention, {
      userId: ctx.userId,
      sessionId: session.sessionId,
      kind: args.kind,
    });
    return { ok: true, sent: true };
  },
});

export const listTokensForUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("devicePushToken")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.map((row) => ({
      token: row.token,
      environment: row.environment,
    }));
  },
});
