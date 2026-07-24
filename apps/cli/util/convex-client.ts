import { ConvexHttpClient } from "convex/browser";
import { loadStoredAuthToken, resolveConvexUrl } from "./auth-session";

export type ConvexClientResolution =
  | {
      status: "ready";
      client: ConvexHttpClient;
      convexUrl: string;
      /** Better Auth session token used to mint the current JWT. */
      sessionToken: string;
      /** The freshly-minted Convex JWT the client was authenticated with. */
      jwt: string;
    }
  | {
      status: "unconfigured";
    }
  | {
      status: "missing_auth";
      convexUrl: string;
    }
  | {
      status: "auth_error";
      convexUrl: string;
      error: Error;
    };

/**
 * Resolve an authenticated Convex client.
 *
 * The device-auth flow stores a Better Auth *session token*, but Convex's
 * `setAuth` requires a *JWT*. We exchange the session token for a short-lived
 * Convex JWT via Better Auth's `/convex/token` endpoint (served on the Convex
 * `.site` domain) using a Bearer header, then authenticate the client with it.
 * The exchange happens per process so the JWT is always fresh.
 */
export async function resolveAuthedConvexClient(): Promise<ConvexClientResolution> {
  const stored = loadStoredAuthToken();
  const convexUrl = resolveConvexUrl() ?? stored?.convexUrl;
  if (!convexUrl) return { status: "unconfigured" };
  if (!stored) return { status: "missing_auth", convexUrl };

  try {
    const jwt = await exchangeSessionForJwt(convexUrl, stored.sessionToken);
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(jwt);
    return { status: "ready", client, convexUrl, sessionToken: stored.sessionToken, jwt };
  } catch (error) {
    return {
      status: "auth_error",
      convexUrl,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/** Convex serves HTTP actions (Better Auth routes) on the `.site` domain. */
export function resolveConvexSiteUrl(convexUrl: string): string {
  const override = process.env.WRAPPER_CONVEX_SITE_URL;
  if (override) return override.trim().replace(/\/+$/, "");
  try {
    const url = new URL(convexUrl);
    if (url.hostname.endsWith(".convex.cloud")) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
      return url.origin;
    }
  } catch {
    // fall through to returning the input unchanged
  }
  return convexUrl.replace(/\/+$/, "");
}

async function exchangeSessionForJwt(convexUrl: string, sessionToken: string): Promise<string> {
  const siteUrl = resolveConvexSiteUrl(convexUrl);
  const res = await fetch(`${siteUrl}/api/auth/convex/token`, {
    method: "GET",
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `failed to exchange session for token (HTTP ${res.status}). Run \`wrapper auth login\` again.`,
    );
  }
  const data = (await res.json()) as { token?: unknown };
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("token exchange returned no token. Run `wrapper auth login` again.");
  }
  return data.token;
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

/** Read the `exp` claim (in ms) from a JWT without verifying it. */
export function decodeJwtExpMs(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export interface AuthAutoRefreshLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
}

export interface AuthAutoRefresh {
  /** Cancel the scheduled refresh (call on shutdown). */
  stop: () => void;
  /** Force an immediate refresh (used reactively on an auth-expiry error). */
  refreshNow: () => Promise<boolean>;
}

/**
 * Keep a long-running client's Convex JWT valid.
 *
 * The device-auth session token is long-lived, but the Convex JWT minted from it
 * is short-lived, so a host that runs for hours would otherwise start failing
 * every backend call once the initial JWT expires. This re-exchanges the session
 * token for a fresh JWT shortly before each one expires (and on demand), calling
 * `setAuth` again. If the session token itself has expired, the exchange fails
 * and the warnings tell the user to run `wrapper auth login` again.
 */
export function startAuthAutoRefresh(params: {
  client: ConvexHttpClient;
  convexUrl: string;
  sessionToken: string;
  jwt: string;
  log?: AuthAutoRefreshLogger;
}): AuthAutoRefresh {
  const { client, convexUrl, sessionToken, jwt, log } = params;
  const MIN_DELAY_MS = 30_000;
  const FALLBACK_DELAY_MS = 30 * 60_000;
  const SKEW_MS = 60_000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let refreshing: Promise<boolean> | null = null;

  const arm = (delayMs: number): void => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void refreshNow();
    }, delayMs);
    timer.unref?.();
  };

  const scheduleFromJwt = (currentJwt: string): void => {
    const expMs = decodeJwtExpMs(currentJwt);
    const delay = expMs ? Math.max(MIN_DELAY_MS, expMs - Date.now() - SKEW_MS) : FALLBACK_DELAY_MS;
    arm(delay);
  };

  const refreshNow = (): Promise<boolean> => {
    if (stopped) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const nextJwt = await exchangeSessionForJwt(convexUrl, sessionToken);
        client.setAuth(nextJwt);
        log?.debug("refreshed convex auth token");
        scheduleFromJwt(nextJwt);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log?.warn("failed to refresh convex auth token", { error: message });
        // Retry soon in case the failure was transient; a genuinely expired
        // session keeps failing and the repeated warning prompts a re-login.
        arm(MIN_DELAY_MS);
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };

  scheduleFromJwt(jwt);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    refreshNow,
  };
}
