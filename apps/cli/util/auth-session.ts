import { existsSync, readFileSync } from "node:fs";
import { env } from "./env";
import { paths } from "./paths";

export const PRODUCTION_CONVEX_URL = "https://confident-fox-458.convex.cloud";

export interface StoredAuthToken {
  provider: "convex-device-auth";
  convexUrl: string;
  sessionToken: string;
  tokenType: string;
  issuedAt: string;
  expiresAt: string;
}

export function resolveConvexUrl(
  environment: Record<string, string | undefined> = process.env,
  isProduction = env.isProd,
): string | null {
  const raw =
    environment.WRAPPER_CONVEX_URL ??
    environment.CONVEX_URL ??
    (isProduction ? PRODUCTION_CONVEX_URL : undefined);
  if (!raw) return null;
  return raw.trim().replace(/\/+$/, "");
}

export function loadStoredAuthToken(): StoredAuthToken | null {
  const file = paths.authFile();
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredAuthToken>;
    if (
      parsed.provider !== "convex-device-auth" ||
      typeof parsed.sessionToken !== "string" ||
      typeof parsed.convexUrl !== "string" ||
      typeof parsed.tokenType !== "string" ||
      typeof parsed.issuedAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    return parsed as StoredAuthToken;
  } catch {
    return null;
  }
}
