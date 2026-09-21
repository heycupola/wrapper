"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useId, useMemo, useState } from "react";
import { IosViewerCta } from "../../../components/ios-viewer-cta";
import { ProIntervalSwitch } from "../../../components/pro-interval-switch";
import { Button } from "../../../components/ui/button";
import { segmentedPanelId, segmentedTabId } from "../../../components/ui/segmented";
import { getSafeBillingPortalUrl, getSafeCheckoutUrl } from "../../../lib/billing-url";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "../../../lib/plan-features";
import { trackWebEvent } from "../../../lib/posthog";
import { PRO_PRICE, PRO_SUMMARY, type BillingInterval } from "../../../lib/pro-pricing";
import { PlanCard } from "./plan-card";

const billingPortalRef = makeFunctionReference<
  "action",
  { returnUrl?: string },
  { portalUrl: string }
>("billing:createBillingPortal");

const checkoutRef = makeFunctionReference<
  "action",
  { successUrl?: string; interval?: "month" | "year" },
  { checkoutUrl: string }
>("billing:createProCheckout");

export function DashboardBilling({
  token,
  plan,
  canManageBilling,
}: {
  token: string;
  plan: "free" | "pro";
  canManageBilling: boolean;
}) {
  const switchId = useId();
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [pending, setPending] = useState<"portal" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = PRO_PRICE[interval];
  const panelId = segmentedPanelId(switchId, interval);
  const tabId = segmentedTabId(switchId, interval);

  const client = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    instance.setAuth(token);
    return instance;
  }, [token]);

  async function openPortal(): Promise<void> {
    if (!client) return setError("Wrapper billing services are temporarily unavailable.");
    setPending("portal");
    setError(null);
    try {
      const returnUrl = new URL("/plan/returned", window.location.origin).toString();
      const result = await client.action(billingPortalRef, { returnUrl });
      const portalUrl = getSafeBillingPortalUrl(result.portalUrl);
      if (!portalUrl) throw new Error("Unexpected billing portal address.");
      window.location.assign(portalUrl);
    } catch {
      setError(
        "The billing portal is temporarily unavailable. Please try again later or contact support.",
      );
      setPending(null);
    }
  }

  async function startCheckout(): Promise<void> {
    if (!client) return setError("Wrapper billing services are temporarily unavailable.");
    setPending("checkout");
    setError(null);
    trackWebEvent("web_upgrade_started");
    try {
      const successUrl = new URL("/plan/upgraded", window.location.origin).toString();
      const result = await client.action(checkoutRef, { successUrl, interval });
      const checkoutUrl = getSafeCheckoutUrl(result.checkoutUrl);
      if (!checkoutUrl) throw new Error("Unexpected checkout address.");
      window.location.assign(checkoutUrl);
    } catch {
      setError(
        "Pro checkout is temporarily unavailable. Please try again later or contact support.",
      );
      setPending(null);
    }
  }

  const checkoutLabel =
    pending === "checkout"
      ? "Starting checkout…"
      : interval === "year"
        ? "Upgrade — $99/year"
        : "Upgrade — $15/month";

  const intervalSwitch = (
    <ProIntervalSwitch
      id={switchId}
      className="dashboardPlanInterval"
      size="sm"
      value={interval}
      onChange={setInterval}
    />
  );

  const proAction =
    plan === "free" ? (
      <Button
        variant="primary"
        block
        disabled={pending !== null}
        loading={pending === "checkout"}
        onClick={() => void startCheckout()}
      >
        {checkoutLabel}
      </Button>
    ) : canManageBilling ? (
      <Button
        block
        disabled={pending !== null}
        loading={pending === "portal"}
        onClick={() => void openPortal()}
      >
        {pending === "portal" ? "Opening portal…" : "Manage billing"}
      </Button>
    ) : (
      <p className="dashboardPlanNote">
        You're on Pro. A paid checkout is what creates a Stripe portal for invoices.
      </p>
    );

  return (
    <>
      <div className="dashboardBillingGrid">
        <PlanCard
          name="Free"
          label={plan === "free" ? "Current plan" : "Included"}
          price="$0"
          period="forever"
          summary="Your shell, on this machine."
          features={FREE_PLAN_FEATURES}
        />
        <PlanCard
          name="Pro"
          label={plan === "pro" ? "Current plan" : "Remote access"}
          price={price.amount}
          period={price.period}
          summary={PRO_SUMMARY}
          features={PRO_PLAN_FEATURES}
          highlighted
          priceId={plan === "free" ? panelId : undefined}
          priceLabelledBy={plan === "free" ? tabId : undefined}
          priceRate={plan === "free" ? (price.rate ?? undefined) : undefined}
          priceControls={plan === "free" ? intervalSwitch : null}
          action={proAction}
        >
          <IosViewerCta variant="text" />
        </PlanCard>
      </div>
      <output className="visuallyHidden">
        {pending === "checkout"
          ? "Starting Pro checkout, you will be taken to Stripe."
          : pending === "portal"
            ? "Opening the billing portal."
            : ""}
      </output>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
