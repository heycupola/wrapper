"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const createProCheckoutRef = makeFunctionReference<
  "action",
  { successUrl?: string },
  { checkoutUrl: string }
>("billing:createProCheckout");

export function UpgradePro({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    instance.setAuth(token);
    return instance;
  }, [token]);

  async function upgrade(): Promise<void> {
    if (!client) {
      setError("Wrapper billing services are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const successUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding?upgraded=1`
          : undefined;
      const result = await client.action(createProCheckoutRef, { successUrl });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setError("Could not start checkout");
    } catch {
      setError("Checkout could not be started. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authCard">
      <p className="authHint">
        Pro unlocks relay sharing. Host a session and attach from anywhere.
      </p>
      <div className="authActions">
        <button
          type="button"
          className="social-btn social-btn-primary"
          disabled={busy}
          onClick={() => void upgrade()}
        >
          {busy ? "Starting checkout…" : "Upgrade to Pro"}
        </button>
      </div>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
