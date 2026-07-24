import { feature, item, plan } from "atmn";

/**
 * Autumn pricing config (config-as-code).
 *
 * Run from this directory so the sandbox key in `.env.local` is loaded:
 *   bunx atmn push            # sync to sandbox
 *   bunx atmn push --prod     # sync to production
 *   bunx atmn pull            # import dashboard changes (overwrites local)
 *
 * `can_share_relay` is the boolean entitlement gating relay sharing — it must
 * match WRAPPER_AUTUMN_RELAY_SHARE_FEATURE_ID (default "can_share_relay") that
 * the backend checks in `convex/relay.ts`.
 *
 * This file is consumed only by the `atmn` CLI; it is excluded from the
 * package tsconfig/lint/format.
 */

// Features
export const canShareRelay = feature({
  id: "can_share_relay",
  name: "Relay sharing",
  type: "boolean",
});

// Plans
export const free = plan({
  id: "free",
  name: "Free",
  autoEnable: true,
  // Free users get the local CLI; relay sharing is a Pro entitlement.
  items: [],
});

export const pro = plan({
  id: "pro",
  name: "Pro",
  price: {
    amount: 20,
    interval: "month",
  },
  items: [
    // Grants the boolean relay-sharing entitlement.
    item({
      featureId: canShareRelay.id,
    }),
  ],
});
