import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { protectedMutation, protectedQuery } from "./lib/middleware.ts";
import { getSessionTimeoutConfig, shouldMarkSessionStale } from "./lib/sessionConfig.ts";
import { createError, ErrorCode } from "./lib/errors.ts";
import { ErrorSeverity } from "./lib/types.ts";

const SESSION_TIMEOUT = getSessionTimeoutConfig();

export const open = protectedMutation({
  args: {
    sessionId: v.string(),
    shell: v.string(),
    cwd: v.string(),
    port: v.optional(v.number()),
    hostPid: v.optional(v.number()),
    shared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!existing) {
      const id = await ctx.db.insert("hostSession", {
        sessionId: args.sessionId,
        ownerUserId: ctx.userId,
        shell: args.shell,
        cwd: args.cwd,
        port: args.port,
        hostPid: args.hostPid,
        shared: args.shared ?? false,
        relayState: "offline",
        relayLastChangedAt: now,
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastHeartbeatAt: now,
      });
      await ctx.scheduler.runAfter(
        SESSION_TIMEOUT.staleScheduleDelayMs,
        internal.session.markStaleIfTimedOut,
        {
          sessionId: args.sessionId,
          expectedLastHeartbeatAt: now,
        },
      );

      return { id, created: true };
    }

    if (existing.ownerUserId !== ctx.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "You cannot open a session owned by another user",
        severity: ErrorSeverity.High,
      });
    }

    await ctx.db.patch(existing._id, {
      shell: args.shell,
      cwd: args.cwd,
      port: args.port,
      hostPid: args.hostPid,
      shared: args.shared ?? existing.shared,
      relayState: existing.relayState ?? "offline",
      relayLastChangedAt: existing.relayLastChangedAt,
      status: "active",
      updatedAt: now,
      lastHeartbeatAt: now,
      closedAt: undefined,
      closeReason: undefined,
    });
    await ctx.scheduler.runAfter(
      SESSION_TIMEOUT.staleScheduleDelayMs,
      internal.session.markStaleIfTimedOut,
      {
        sessionId: args.sessionId,
        expectedLastHeartbeatAt: now,
      },
    );

    return { id: existing._id, created: false };
  },
});

export const heartbeat = protectedMutation({
  args: {
    sessionId: v.string(),
    shared: v.optional(v.boolean()),
    port: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!existing) {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Session not found",
        severity: ErrorSeverity.Medium,
      });
    }

    if (existing.ownerUserId !== ctx.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "You cannot heartbeat a session owned by another user",
        severity: ErrorSeverity.High,
      });
    }

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "active",
      shared: args.shared ?? existing.shared,
      relayState: existing.relayState,
      relayLastChangedAt: existing.relayLastChangedAt,
      port: args.port ?? existing.port,
      updatedAt: now,
      lastHeartbeatAt: now,
    });
    await ctx.scheduler.runAfter(
      SESSION_TIMEOUT.staleScheduleDelayMs,
      internal.session.markStaleIfTimedOut,
      {
        sessionId: args.sessionId,
        expectedLastHeartbeatAt: now,
      },
    );

    return { ok: true };
  },
});

export const close = protectedMutation({
  args: {
    sessionId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!existing) {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Session not found",
        severity: ErrorSeverity.Medium,
      });
    }

    if (existing.ownerUserId !== ctx.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "You cannot close a session owned by another user",
        severity: ErrorSeverity.High,
      });
    }

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "closed",
      updatedAt: now,
      closedAt: now,
      closeReason: args.reason,
    });

    return { ok: true };
  },
});

export const listActive = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("hostSession")
      .withIndex("by_owner_status", (q) => q.eq("ownerUserId", ctx.userId).eq("status", "active"))
      .collect();

    return sessions.toSorted((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const authorizeAttach = protectedQuery({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session || session.status !== "active") {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Active session not found",
        severity: ErrorSeverity.Medium,
      });
    }

    const isOwner = session.ownerUserId === ctx.userId;
    if (!isOwner && !session.shared) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "You are not allowed to attach to this session",
        severity: ErrorSeverity.High,
      });
    }

    return {
      ok: true,
      sessionId: session.sessionId,
      port: session.port,
      shared: session.shared,
      isOwner,
      updatedAt: session.updatedAt,
    };
  },
});

export const setRelayState = protectedMutation({
  args: {
    sessionId: v.string(),
    relayState: v.union(
      v.literal("offline"),
      v.literal("connecting"),
      v.literal("online"),
      v.literal("error"),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Session not found",
        severity: ErrorSeverity.Medium,
      });
    }
    if (session.ownerUserId !== ctx.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "You cannot change relay state for another user's session",
        severity: ErrorSeverity.High,
      });
    }

    await ctx.db.patch(session._id, {
      relayState: args.relayState,
      relayLastChangedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const markStaleIfTimedOut = internalMutation({
  args: {
    sessionId: v.string(),
    expectedLastHeartbeatAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("hostSession")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!session) return { closed: false };
    if (
      !shouldMarkSessionStale({
        status: session.status,
        lastHeartbeatAt: session.lastHeartbeatAt,
        expectedLastHeartbeatAt: args.expectedLastHeartbeatAt,
      })
    ) {
      return { closed: false };
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "closed",
      updatedAt: now,
      closedAt: now,
      closeReason: "stale_timeout",
    });
    return { closed: true };
  },
});
