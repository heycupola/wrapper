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
    };

export function resolveAuthedConvexClient(): ConvexClientResolution {
  const stored = loadStoredAuthToken();
  const convexUrl = resolveConvexUrl() ?? stored?.convexUrl;
  if (!convexUrl) return { status: "unconfigured" };
  if (!stored) return { status: "missing_auth", convexUrl };

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(stored.sessionToken);
  return { status: "ready", client, convexUrl };
}
