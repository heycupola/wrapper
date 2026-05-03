import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { createError, ErrorCode } from "./lib/errors.ts";
import { protectedMutation, publicMutation } from "./lib/middleware.ts";
import { getRelayTicketConfig, createRelayTicket, hashRelayTicket } from "./lib/relayTicket.ts";
import { ErrorSeverity } from "./lib/types.ts";

const RELAY_TICKET = getRelayTicketConfig();

export const issueHostTicket = protectedMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await findActiveSession(ctx, args.sessionId);
    if (!session) {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Active session not found",
        severity: ErrorSeverity.Medium,
      });
    }
    if (session.ownerUserId !== ctx.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "Only session owner can request host relay ticket",
        severity: ErrorSeverity.High,
      });
    }

    return await issueTicket(ctx, {
      sessionId: args.sessionId,
      userId: ctx.userId,
      role: "host",
      ttlMs: RELAY_TICKET.hostTtlMs,
    });
  },
});

export const issueViewerTicket = protectedMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await findActiveSession(ctx, args.sessionId);
    if (!session) {
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
        message: "Session is not shared",
        severity: ErrorSeverity.High,
      });
    }

    return await issueTicket(ctx, {
      sessionId: args.sessionId,
      userId: ctx.userId,
      role: "viewer",
      ttlMs: RELAY_TICKET.viewerTtlMs,
    });
  },
});

export const consumeTicket = publicMutation({
  args: {
    ticket: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await hashRelayTicket(args.ticket);
    const now = Date.now();
    const row = await ctx.db
      .query("relayTicket")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!row) {
      throw createError({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid relay ticket",
        severity: ErrorSeverity.Medium,
      });
    }
    if (row.usedAt) {
      throw createError({
        code: ErrorCode.UNAUTHORIZED,
        message: "Relay ticket already used",
        severity: ErrorSeverity.Medium,
      });
    }
    if (row.expiresAt <= now) {
      throw createError({
        code: ErrorCode.UNAUTHORIZED,
        message: "Relay ticket expired",
        severity: ErrorSeverity.Medium,
      });
    }

    const session = await findActiveSession(ctx, row.sessionId);
    if (!session) {
      throw createError({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "Active session not found",
        severity: ErrorSeverity.Medium,
      });
    }

    if (row.role === "viewer" && !session.shared && session.ownerUserId !== row.userId) {
      throw createError({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
        message: "Session is no longer shared",
        severity: ErrorSeverity.High,
      });
    }

    await ctx.db.patch(row._id, { usedAt: now });
    return {
      sessionId: row.sessionId,
      role: row.role,
      userId: row.userId,
      expiresAt: row.expiresAt,
    };
  },
});

export const cleanupTicket = internalMutation({
  args: {
    ticketId: v.id("relayTicket"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.ticketId);
    if (!row) return { deleted: false };
    if (row.usedAt) {
      await ctx.db.delete(args.ticketId);
      return { deleted: true };
    }
    if (row.expiresAt <= Date.now()) {
      await ctx.db.delete(args.ticketId);
      return { deleted: true };
    }
    return { deleted: false };
  },
});

async function findActiveSession(ctx: MutationCtx, sessionId: string) {
  const session = await ctx.db
    .query("hostSession")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .first();
  if (!session || session.status !== "active") return null;
  return session;
}

async function issueTicket(
  ctx: MutationCtx,
  input: {
    sessionId: string;
    role: "host" | "viewer";
    userId: string;
    ttlMs: number;
  },
): Promise<{ ticket: string; expiresAt: number }> {
  const now = Date.now();
  const ticket = createRelayTicket();
  const tokenHash = await hashRelayTicket(ticket);
  const expiresAt = now + input.ttlMs;

  const ticketId = await ctx.db.insert("relayTicket", {
    tokenHash,
    sessionId: input.sessionId,
    role: input.role,
    userId: input.userId,
    createdAt: now,
    expiresAt,
  });
  await ctx.scheduler.runAfter(input.ttlMs + 5_000, internal.relay.cleanupTicket, {
    ticketId,
  });

  return { ticket, expiresAt };
}
