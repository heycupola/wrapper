export const CONSENT_STORAGE_KEY = "wrapper-cookie-consent";

export type ConsentState = "accepted" | "rejected";

export function parseConsent(value: string | null | undefined): ConsentState | null {
  if (value === "accepted" || value === "rejected") return value;
  return null;
}

export function readStoredConsent(): ConsentState | null {
  if (typeof localStorage === "undefined") return null;
  return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
}

export function saveStoredConsent(state: ConsentState): void {
  localStorage.setItem(CONSENT_STORAGE_KEY, state);
}
