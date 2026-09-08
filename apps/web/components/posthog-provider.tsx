"use client";

import { type ReactNode, useEffect, useState } from "react";
import { readStoredConsent } from "../lib/analytics-consent";
import { getCookieValue } from "../lib/cookies";
import { GEO_COOKIE, isEuGeo } from "../lib/geo";
import { initPostHog, isPostHogConfigured } from "../lib/posthog";
import { AnalyticsConsentBanner } from "./analytics-consent";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isPostHogConfigured()) {
      setReady(true);
      return;
    }

    const eu = isEuGeo(getCookieValue(GEO_COOKIE));
    const consent = readStoredConsent();

    if (!eu || consent === "accepted") {
      initPostHog({ persistCookies: true });
    }

    setReady(true);
  }, []);

  return (
    <>
      {children}
      {ready && isPostHogConfigured() ? (
        <AnalyticsConsentBanner
          onAccept={() => {
            initPostHog({ persistCookies: true });
          }}
        />
      ) : null}
    </>
  );
}
