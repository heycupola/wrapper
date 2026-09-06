/**
 * Pure helpers for the release-notes signup. Kept free of Convex imports so
 * unit tests can exercise validation without a runtime.
 */

export const MAX_EMAIL_LENGTH = 254;
export const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
/** Pending rows older than this past their expiry are swept by the cron. */
export const PENDING_SWEEP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Submissions faster than this since the form rendered are treated as bots.
 * Cheap to fake, but it removes the naive spray-and-pray tier for free.
 */
export const MIN_FORM_ELAPSED_MS = 1200;

// Practical shape check, not RFC 5322. The confirmation email is the real
// validator; this only keeps junk out of the table and the send queue.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_PATTERN.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  return trimmed;
}

/**
 * True when the request looks automated: the honeypot field carried a value
 * or the form was submitted before a person could have read it.
 */
export function looksAutomated(input: { honeypot?: string; elapsedMs?: number }): boolean {
  if (input.honeypot && input.honeypot.trim().length > 0) return true;
  if (typeof input.elapsedMs === "number" && input.elapsedMs >= 0) {
    return input.elapsedMs < MIN_FORM_ELAPSED_MS;
  }
  return false;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function createOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

/** Short, stable bucket for rate-limit keys so the limiter table stays small. */
export async function rateLimitBucket(value: string): Promise<string> {
  return (await sha256Hex(value)).slice(0, 16);
}
