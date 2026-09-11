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
 * List price: `pro` is $15/month and `pro_yearly` is $99/year. Both grant the
 * same feature. After editing, sync Autumn:
 *   bunx atmn push
 *   bunx atmn push --prod
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
    amount: 15,
    interval: "month",
  },
  items: [
    item({
      featureId: canShareRelay.id,
    }),
  ],
});

export const proYearly = plan({
  id: "pro_yearly",
  name: "Pro (yearly)",
  price: {
    amount: 99,
    interval: "year",
  },
  items: [
    item({
      featureId: canShareRelay.id,
    }),
  ],
});
