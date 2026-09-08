import { posthog } from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://telemetry.wrapper.sh";

let initialized = false;

export function isPostHogConfigured(): boolean {
  return POSTHOG_KEY.length > 0;
}

/**
 * Client-side PostHog. Disabled when the project key is empty.
 * Callers only initialize after non-EU geo or explicit consent, and persist
 * with cookies in those cases.
 */
export function initPostHog(options?: { persistCookies?: boolean }): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;

  const persistCookies = options?.persistCookies ?? false;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    persistence: persistCookies ? "localStorage+cookie" : "memory",
    capture_pageview: true,
    capture_pageleave: true,
    // Autocapture can pick up emails and other copy from the dashboard.
    autocapture: false,
  });

  initialized = true;
}

export function trackWebEvent(event: string, properties?: Record<string, unknown>): void {
  if (!POSTHOG_KEY || !initialized) return;
  posthog.capture(event, properties);
}

export { posthog };
