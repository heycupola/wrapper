"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useMemo, useState } from "react";
import { getSafeBillingPortalUrl, getSafeCheckoutUrl } from "../../../lib/billing-url";

const billingPortalRef = makeFunctionReference<
  "action",
  { returnUrl?: string },
  { portalUrl: string }
>("billing:createBillingPortal");

const checkoutRef = makeFunctionReference<
  "action",
  { successUrl?: string },
  { checkoutUrl: string }
>("billing:createProCheckout");

export function DashboardBillingActions({
  token,
  canManageBilling,
}: {
  token: string;
  canManageBilling: boolean;
}) {
  const [pending, setPending] = useState<"portal" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const returnUrl = new URL("/dashboard/billing", window.location.origin).toString();
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
    try {
      const successUrl = new URL(
        "/dashboard/billing?upgraded=1",
        window.location.origin,
      ).toString();
      const result = await client.action(checkoutRef, { successUrl });
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

  return (
    <section className="dashboardActionPanel" aria-labelledby="billing-actions-title">
      <div>
        <h2 id="billing-actions-title">Billing actions</h2>
        <p>
          {canManageBilling
            ? "Use Stripe for subscription management or start a new Pro checkout."
            : "Upgrade to Pro when a session needs to leave this machine."}
        </p>
      </div>
      <div className="authActions">
        <button
          type="button"
          className="social-btn social-btn-primary"
          disabled={pending !== null}
          onClick={() => void startCheckout()}
        >
          {pending === "checkout" ? "Starting checkout…" : "Upgrade to Pro"}
        </button>
        {canManageBilling ? (
          <button
            type="button"
            className="social-btn"
            disabled={pending !== null}
            onClick={() => void openPortal()}
          >
            {pending === "portal" ? "Opening portal…" : "Manage billing"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
