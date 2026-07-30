import type { MutationCtx } from "../_generated/server.js";
import { makeFunctionReference } from "convex/server";
import { createError, ErrorCode } from "./errors.ts";
import { ErrorSeverity } from "./types.ts";

export type RateLimitOptions = {
  /** Maximum allowed calls per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

const cleanupRateLimitRef = makeFunctionReference<
  "mutation",
  { key: string; expectedResetAt: number },
  { deleted: boolean }
>("rateLimitCleanup:remove");

async function scheduleCleanup(ctx: MutationCtx, key: string, resetAt: number): Promise<void> {
  await ctx.scheduler.runAfter(Math.max(0, resetAt - Date.now()) + 60_000, cleanupRateLimitRef, {
    key,
    expectedResetAt: resetAt,
  });
}

/**
 * Fixed-window rate limiter for unauthenticated endpoints.
 *
 * Keys should be low-cardinality (e.g. `requestDeviceCode:global` or
 * per-clientId) so the backing table stays small. Throws
 * `RATE_LIMIT_EXCEEDED` with a `retryAfterMs` hint when the window is full.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  key: string,
  options: RateLimitOptions,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimit")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!existing) {
    const resetAt = now + options.windowMs;
    await ctx.db.insert("rateLimit", { key, count: 1, resetAt });
    await scheduleCleanup(ctx, key, resetAt);
    return;
  }

  if (existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    await ctx.db.patch(existing._id, { count: 1, resetAt });
    await scheduleCleanup(ctx, key, resetAt);
    return;
  }

  if (existing.count >= options.limit) {
    const retryAfterMs = existing.resetAt - now;
    throw createError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: `Rate limit exceeded. Retry in ${Math.ceil(retryAfterMs / 1000)}s`,
      severity: ErrorSeverity.Low,
      metadata: { retryAfterMs },
    });
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}
