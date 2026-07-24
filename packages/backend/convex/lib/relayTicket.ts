const DEFAULT_TICKET_TTL_MS = 60_000;
const DEFAULT_HOST_TICKET_TTL_MS = 30_000;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

export interface RelayTicketConfig {
  hostTtlMs: number;
  viewerTtlMs: number;
}

export function getRelayTicketConfig(
  env: Record<string, string | undefined> = process.env,
): RelayTicketConfig {
  return {
    hostTtlMs: parsePositiveInt(env.WRAPPER_RELAY_HOST_TICKET_TTL_MS, DEFAULT_HOST_TICKET_TTL_MS),
    viewerTtlMs: parsePositiveInt(env.WRAPPER_RELAY_VIEWER_TICKET_TTL_MS, DEFAULT_TICKET_TTL_MS),
  };
}

export function createRelayTicket(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashRelayTicket(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/**
 * Normalize a share code so display formatting never affects matching:
 * uppercase, and strip anything that is not A-Z or 0-9 (dashes, spaces).
 * Both storing (owner) and verifying (viewer) must run this first.
 */
export function normalizeShareCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashShareCode(code: string): Promise<string> {
  return hashRelayTicket(normalizeShareCode(code));
}
