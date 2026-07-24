import { ConvexHttpClient } from "convex/browser";
import { loadStoredAuthToken, resolveConvexUrl } from "./auth-session";

export type ConvexClientResolution =
  | {
      status: "ready";
      client: ConvexHttpClient;
      convexUrl: string;
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
    return { status: "ready", client, convexUrl };
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
