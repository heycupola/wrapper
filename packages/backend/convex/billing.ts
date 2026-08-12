import { v } from "convex/values";
import { createError, ErrorCode } from "./lib/errors.ts";
import { protectedAction } from "./lib/middleware.ts";
import { ErrorSeverity } from "./lib/types.ts";

const appOrigin = new URL(
  process.env.SITE_URL ??
    (process.env.ENVIRONMENT === "development"
      ? "http://localhost:3000"
      : "https://www.wrapper.sh"),
).origin;
const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";
const STRIPE_PORTAL_ORIGIN = "https://billing.stripe.com";

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
    const successUrl = args.successUrl
      ? requireAllowedUrl(args.successUrl, appOrigin, "checkout return")
      : undefined;
    const result = await ctx.autumn.attach(ctx, {
      productId: getProPlanId(),
      forceCheckout: true,
      ...(successUrl ? { successUrl } : {}),
    });

    if (result.error || !result.data?.checkout_url) {
      throw createError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: "Unable to start Pro checkout",
        severity: ErrorSeverity.High,
      });
    }

    return {
      checkoutUrl: requireAllowedUrl(result.data.checkout_url, STRIPE_CHECKOUT_ORIGIN, "checkout"),
    };
  },
});

export const createBillingPortal = protectedAction({
  args: {
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const returnUrl = args.returnUrl
      ? requireAllowedUrl(args.returnUrl, appOrigin, "billing return")
      : undefined;
    const result = await ctx.autumn.customers.billingPortal(ctx, returnUrl ? { returnUrl } : {});

    if (result.error || !result.data?.url) {
      throw createError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: "Unable to open the billing portal",
        severity: ErrorSeverity.High,
      });
    }

    return {
      portalUrl: requireAllowedUrl(result.data.url, STRIPE_PORTAL_ORIGIN, "billing portal"),
    };
  },
});

function requireAllowedUrl(value: string, expectedOrigin: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidUrl(label);
  }
  if (url.origin !== expectedOrigin || url.username || url.password) {
    throw invalidUrl(label);
  }
  return url.toString();
}

function invalidUrl(label: string): Error {
  return createError({
    code: ErrorCode.INVALID_ARGUMENTS,
    message: `Invalid ${label} URL`,
    severity: ErrorSeverity.Medium,
  });
}
