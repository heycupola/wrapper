const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 15_000;
const SLOW_DOWN_INCREMENT_MS = 1_000;

const KNOWN_DEVICE_AUTH_ERRORS = [
  "authorization_pending",
  "slow_down",
  "access_denied",
  "expired_token",
  "invalid_request",
] as const;

export class DeviceAuthPollingCancelledError extends Error {
  constructor() {
    super("Device authorization was cancelled.");
    this.name = "DeviceAuthPollingCancelledError";
  }
}

type DeviceTokenPollingOptions<Token> = {
  expiresInSeconds: number;
  intervalSeconds: number;
  isCancelled?: () => boolean;
  now?: () => number;
  poll: () => Promise<Token>;
  sleep?: (milliseconds: number) => Promise<void>;
};

export function normalizeDeviceAuthErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message.length > 0
      ? error.message
      : typeof error === "string" && error.length > 0
        ? error
        : "unknown_error";

  for (const code of KNOWN_DEVICE_AUTH_ERRORS) {
    if (raw.includes(code)) return code;
  }
  return raw;
}

export async function pollForDeviceToken<Token>(
  options: DeviceTokenPollingOptions<Token>,
): Promise<Token> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const durationMs = Math.max(0, options.expiresInSeconds * 1_000);
  const expiresAt = now() + durationMs;
  const requestedIntervalMs = options.intervalSeconds * 1_000;
  let intervalMs = Number.isFinite(requestedIntervalMs)
    ? Math.max(MIN_POLL_INTERVAL_MS, requestedIntervalMs)
    : MIN_POLL_INTERVAL_MS;

  while (now() < expiresAt) {
    throwIfCancelled(options.isCancelled);
    // Polling must stay sequential to honor the server-provided interval.
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
    throwIfCancelled(options.isCancelled);
    if (now() >= expiresAt) break;

    try {
      // Await here so the loop can classify protocol errors before continuing.
      // eslint-disable-next-line no-await-in-loop
      return await options.poll();
    } catch (error) {
      const message = normalizeDeviceAuthErrorMessage(error);
      if (message === "authorization_pending") continue;
      if (message === "slow_down") {
        intervalMs = Math.min(intervalMs + SLOW_DOWN_INCREMENT_MS, MAX_POLL_INTERVAL_MS);
        continue;
      }
      if (message === "access_denied") {
        throw new Error("Device authorization was denied.", { cause: error });
      }
      if (message === "expired_token") {
        throw new Error("Device code expired. Run `wrapper auth login` again.", { cause: error });
      }
      throw new Error(`Token polling failed: ${message}`, { cause: error });
    }
  }

  throw new Error("Device authorization timed out. Run `wrapper auth login` again.");
}

function throwIfCancelled(isCancelled: (() => boolean) | undefined): void {
  if (isCancelled?.()) throw new DeviceAuthPollingCancelledError();
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
