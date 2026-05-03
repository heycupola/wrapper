const DEFAULT_STALE_AFTER_MS = 60_000;
const DEFAULT_STALE_GRACE_MS = 10_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export interface SessionTimeoutConfig {
  staleAfterMs: number;
  staleGraceMs: number;
  staleScheduleDelayMs: number;
}

export function getSessionTimeoutConfig(
  env: Record<string, string | undefined> = process.env,
): SessionTimeoutConfig {
  const staleAfterMs = parsePositiveInt(env.WRAPPER_SESSION_STALE_AFTER_MS, DEFAULT_STALE_AFTER_MS);
  const staleGraceMs = parsePositiveInt(env.WRAPPER_SESSION_STALE_GRACE_MS, DEFAULT_STALE_GRACE_MS);
  return {
    staleAfterMs,
    staleGraceMs,
    staleScheduleDelayMs: staleAfterMs + staleGraceMs,
  };
}

export function shouldMarkSessionStale(input: {
  status: "active" | "closed";
  lastHeartbeatAt: number;
  expectedLastHeartbeatAt: number;
}): boolean {
  return input.status === "active" && input.lastHeartbeatAt === input.expectedLastHeartbeatAt;
}
