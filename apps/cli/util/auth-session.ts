import { existsSync, readFileSync } from "node:fs";
import { paths } from "./paths";

export interface StoredAuthToken {
  provider: "convex-device-auth";
  convexUrl: string;
  sessionToken: string;
  tokenType: string;
  issuedAt: string;
  expiresAt: string;
}

export function resolveConvexUrl(): string | null {
  const raw = process.env.WRAPPER_CONVEX_URL ?? process.env.CONVEX_URL;
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
