import { v } from "convex/values";
import { createError, ErrorCode } from "./lib/errors.ts";
import { protectedAction } from "./lib/middleware.ts";
import { ErrorSeverity } from "./lib/types.ts";

function getProPlanId(): string {
  const value = process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
  if (!value) return "pro";
  return value.trim();
}

/**
 * Start a Pro checkout for the current user and return a Stripe checkout URL.
 *
 * Used by both the web "Upgrade to Pro" button (redirect) and the CLI (which
 * prints the link when relay sharing is denied). Autumn is the source of truth
 * for entitlements: once the user completes payment, `autumn.check` reflects
 * Pro automatically, and it reverts when the plan expires — no extra syncing.
 */
export const createProCheckout = protectedAction({
  args: {
    successUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.autumn.attach(ctx, {
      productId: getProPlanId(),
      forceCheckout: true,
      ...(args.successUrl ? { successUrl: args.successUrl } : {}),
    });

    if (result.error || !result.data?.checkout_url) {
      throw createError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: "Unable to start Pro checkout",
        severity: ErrorSeverity.High,
      });
    }

    return { checkoutUrl: result.data.checkout_url };
  },
});
