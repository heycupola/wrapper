"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStoredConsent, saveStoredConsent, type ConsentState } from "../lib/analytics-consent";
import { getCookieValue } from "../lib/cookies";
import { GEO_COOKIE, isEuGeo } from "../lib/geo";
import { isPostHogConfigured } from "../lib/posthog";
import { Button } from "./ui/button";

export function useCookieConsent(): {
  consentState: ConsentState | null;
  isEU: boolean;
  ready: boolean;
  accept: () => void;
  reject: () => void;
} {
  const [isEU, setIsEU] = useState(false);
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsEU(isEuGeo(getCookieValue(GEO_COOKIE)));
    setConsentState(readStoredConsent());
    setReady(true);
  }, []);

  const accept = () => {
    saveStoredConsent("accepted");
    setConsentState("accepted");
  };

  const reject = () => {
    saveStoredConsent("rejected");
    setConsentState("rejected");
  };

  return { consentState, isEU, ready, accept, reject };
}

export function AnalyticsConsentBanner({ onAccept }: { onAccept?: () => void }) {
  const { consentState, isEU, ready, accept, reject } = useCookieConsent();

  if (!isPostHogConfigured() || !ready || !isEU || consentState !== null) return null;

  return (
    <aside className="analyticsConsent" aria-label="Analytics cookies">
      <p>
        We use cookies for anonymous product analytics.{" "}
        <Link href="/privacy-policy">Privacy Policy</Link>
      </p>
      <div className="analyticsConsentActions">
        <Button
          onClick={() => {
            reject();
          }}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            accept();
            onAccept?.();
          }}
        >
          Accept
        </Button>
      </div>
    </aside>
  );
}
