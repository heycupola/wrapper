import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { createError, ErrorCode } from "./lib/errors.ts";
import { createLogger } from "./lib/logger.ts";
import { enforceRateLimit, rateLimitKeys } from "./lib/rateLimit.ts";
import {
  CONFIRM_TOKEN_TTL_MS,
  createOpaqueToken,
  looksAutomated,
  normalizeEmail,
  PENDING_SWEEP_GRACE_MS,
  rateLimitBucket,
  sha256Hex,
} from "./lib/releaseNotes.ts";
import { EmailKind, ErrorSeverity } from "./lib/types.ts";
import { sendEmailDirect } from "./resend.ts";

const log = createLogger("releaseNotes");

const SITE_URL =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://www.wrapper.sh");

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Ceilings for the public intake. Global windows cap the Resend bill and
 * table growth if every other control fails; per-client windows stop one
 * visitor from flooding; per-email windows stop confirmation spam to a
 * third party's inbox.
 */
const LIMITS = {
  subscribeGlobalMinute: { limit: 40, windowMs: MINUTE_MS },
  subscribeGlobalHour: { limit: 400, windowMs: HOUR_MS },
  subscribeClient: { limit: 5, windowMs: HOUR_MS },
  subscribeEmail: { limit: 3, windowMs: DAY_MS },
  confirmGlobal: { limit: 120, windowMs: MINUTE_MS },
  unsubscribeGlobal: { limit: 120, windowMs: MINUTE_MS },
} as const;

const SWEEP_BATCH = 200;

/**
 * The web app's route handler calls `subscribe` on the visitor's behalf,
 * adding a hashed client address for per-client limits. The shared secret
 * keeps callers from skipping that hop and picking their own bucket. When it
 * is unset (local dev) the check is skipped; the global and per-email windows
 * still apply.
 */
function requireIngestSecret(provided: string | undefined): void {
  const expected = process.env.RELEASE_NOTES_INGEST_SECRET;
  if (!expected) return;
  if (!provided || !constantTimeEqual(provided, expected)) {
    throw createError({
      code: ErrorCode.UNAUTHORIZED,
      message: "Release-notes intake requires the ingest secret",
      severity: ErrorSeverity.Medium,
    });
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

/**
 * Landing-page signup. Always answers `check_inbox` for a well-formed request
 * so the response never reveals whether an address is already on the list;
 * the confirmation email carries the real state.
 */
export const subscribe = mutation({
  args: {
    /** Shared secret from the web app's route handler. */
    ingestSecret: v.optional(v.string()),
    /** Hashed client address supplied by the route handler; never a raw IP. */
    clientBucket: v.string(),
    /** Where on the site the form lived, e.g. `landing-questions`. */
    source: v.string(),
    /** Hidden field that only bots fill. */
    honeypot: v.optional(v.string()),
    /** Milliseconds between the form rendering and the submit. */
    elapsedMs: v.optional(v.number()),
    email: v.string(),
  },
  returns: v.object({ status: v.literal("check_inbox") }),
  handler: async (ctx, args) => {
    requireIngestSecret(args.ingestSecret);

    // Bots get the same answer as people and cost nothing further.
    if (looksAutomated(args)) {
      log.info("Dropped automated subscribe", { source: args.source });
      return { status: "check_inbox" as const };
    }

    const email = normalizeEmail(args.email);
    if (!email) {
      throw createError({
        code: ErrorCode.INVALID_ARGUMENTS,
        message: "Enter a valid email address",
        severity: ErrorSeverity.Low,
      });
    }

    await enforceRateLimit(
      ctx,
      rateLimitKeys.releaseNotes.subscribeClient(args.clientBucket),
      LIMITS.subscribeClient,
    );
    await enforceRateLimit(
      ctx,
      rateLimitKeys.releaseNotes.subscribeEmail(await rateLimitBucket(email)),
      LIMITS.subscribeEmail,
    );
    await enforceRateLimit(
      ctx,
      rateLimitKeys.releaseNotes.subscribeGlobalMinute,
      LIMITS.subscribeGlobalMinute,
    );
    await enforceRateLimit(
      ctx,
      rateLimitKeys.releaseNotes.subscribeGlobalHour,
      LIMITS.subscribeGlobalHour,
    );

    const now = Date.now();
    const confirmToken = createOpaqueToken();
    const confirmTokenHash = await sha256Hex(confirmToken);
    const confirmExpiresAt = now + CONFIRM_TOKEN_TTL_MS;

    const existing = await ctx.db
      .query("releaseNoteSubscriber")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    let subscriberId: Id<"releaseNoteSubscriber">;
    if (!existing) {
      subscriberId = await ctx.db.insert("releaseNoteSubscriber", {
        email,
        source: args.source,
        status: "pending",
        confirmTokenHash,
        confirmExpiresAt,
        unsubscribeToken: createOpaqueToken(),
        createdAt: now,
        updatedAt: now,
      });
    } else if (existing.status === "confirmed") {
      // Already on the list: re-issue a token so the visitor gets the same
      // inbox experience without the response giving the state away.
      subscriberId = existing._id;
      await ctx.db.patch(existing._id, { confirmTokenHash, confirmExpiresAt, updatedAt: now });
    } else {
      // Pending or previously unsubscribed: start a fresh opt-in.
      subscriberId = existing._id;
      await ctx.db.patch(existing._id, {
        source: args.source,
        status: "pending",
        confirmTokenHash,
        confirmExpiresAt,
        unsubscribeToken:
          existing.status === "unsubscribed" ? createOpaqueToken() : existing.unsubscribeToken,
        updatedAt: now,
        unsubscribedAt: undefined,
      });
    }

    await ctx.scheduler.runAfter(0, internal.releaseNotes._sendConfirmation, {
      subscriberId,
      confirmToken,
    });

    return { status: "check_inbox" as const };
  },
});

export const _getSubscriber = internalQuery({
  args: { subscriberId: v.id("releaseNoteSubscriber") },
  handler: async (ctx, args): Promise<Doc<"releaseNoteSubscriber"> | null> => {
    return await ctx.db.get(args.subscriberId);
  },
});

export const _markConfirmSent = internalMutation({
  args: { subscriberId: v.id("releaseNoteSubscriber"), sentAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.subscriberId);
    if (row) await ctx.db.patch(row._id, { confirmSentAt: args.sentAt });
    return null;
  },
});

export const _sendConfirmation = internalAction({
  args: {
    subscriberId: v.id("releaseNoteSubscriber"),
    confirmToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscriber = await ctx.runQuery(internal.releaseNotes._getSubscriber, {
      subscriberId: args.subscriberId,
    });
    if (!subscriber) return null;

    const confirmUrl = `${SITE_URL}/release-notes/confirm?token=${args.confirmToken}`;
    const unsubscribeUrl = `${SITE_URL}/release-notes/unsubscribe?token=${subscriber.unsubscribeToken}`;

    const result = await sendEmailDirect(subscriber.email, {
      kind: EmailKind.ReleaseNotesConfirm,
      confirmUrl,
      unsubscribeUrl,
    });

    if (result.emailId === "skipped") {
      // No Resend key (local dev): surface the link so the flow stays testable.
      log.info("Confirmation email skipped; confirm locally", { confirmUrl });
    }

    await ctx.runMutation(internal.releaseNotes._markConfirmSent, {
      subscriberId: args.subscriberId,
      sentAt: Date.now(),
    });
    return null;
  },
});

const confirmResult = v.union(
  v.object({ ok: v.literal(true), email: v.string(), alreadyConfirmed: v.boolean() }),
  v.object({ ok: v.literal(false), reason: v.union(v.literal("invalid"), v.literal("expired")) }),
);

/** Completes the double opt-in. Idempotent for a token that was already used. */
export const confirm = mutation({
  args: { token: v.string() },
  returns: confirmResult,
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, rateLimitKeys.releaseNotes.confirmGlobal, LIMITS.confirmGlobal);

    if (!/^[0-9a-f]{64}$/.test(args.token))
      return { ok: false as const, reason: "invalid" as const };

    const tokenHash = await sha256Hex(args.token);
    const row = await ctx.db
      .query("releaseNoteSubscriber")
      .withIndex("by_confirmTokenHash", (q) => q.eq("confirmTokenHash", tokenHash))
      .first();
    if (!row) return { ok: false as const, reason: "invalid" as const };

    const now = Date.now();
    if (row.confirmExpiresAt !== undefined && row.confirmExpiresAt < now) {
      return { ok: false as const, reason: "expired" as const };
    }

    const alreadyConfirmed = row.status === "confirmed";
    await ctx.db.patch(row._id, {
      status: "confirmed",
      confirmTokenHash: undefined,
      confirmExpiresAt: undefined,
      confirmedAt: alreadyConfirmed ? row.confirmedAt : now,
      updatedAt: now,
    });

    log.info("Subscriber confirmed", { alreadyConfirmed });
    return { ok: true as const, email: row.email, alreadyConfirmed };
  },
});

/** One-click unsubscribe from the link in every email. Idempotent. */
export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await enforceRateLimit(
      ctx,
      rateLimitKeys.releaseNotes.unsubscribeGlobal,
      LIMITS.unsubscribeGlobal,
    );

    if (!/^[0-9a-f]{64}$/.test(args.token)) return { ok: false };

    const row = await ctx.db
      .query("releaseNoteSubscriber")
      .withIndex("by_unsubscribeToken", (q) => q.eq("unsubscribeToken", args.token))
      .first();
    if (!row) return { ok: false };
    if (row.status === "unsubscribed") return { ok: true };

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "unsubscribed",
      confirmTokenHash: undefined,
      confirmExpiresAt: undefined,
      unsubscribedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** Drops pending signups whose confirmation link expired a week ago. */
export const sweepExpiredPending = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - PENDING_SWEEP_GRACE_MS;
    const rows = await ctx.db
      .query("releaseNoteSubscriber")
      .withIndex("by_status_confirmExpiresAt", (q) =>
        q.eq("status", "pending").lt("confirmExpiresAt", cutoff),
      )
      .take(SWEEP_BATCH + 1);
    const batch = rows.slice(0, SWEEP_BATCH);
    for (const row of batch) await ctx.db.delete(row._id);
    return { deleted: batch.length, hasMore: rows.length > SWEEP_BATCH };
  },
});

/** For the eventual release mailer: every confirmed address. */
export const _listConfirmed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("releaseNoteSubscriber")
      .withIndex("by_status_confirmExpiresAt", (q) => q.eq("status", "confirmed"))
      .collect();
    return rows.map((row) => ({ email: row.email, unsubscribeToken: row.unsubscribeToken }));
  },
});
