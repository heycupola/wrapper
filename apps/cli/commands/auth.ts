import * as p from "@clack/prompts";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { paths } from "../util/paths";
import { installShutdownHandlers } from "../util/signals";

const log = createLogger("auth");

type RequestDeviceCodeArgs = {
  clientId?: string;
  scope?: string;
};

type RequestDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

type PollDeviceTokenArgs = {
  device_code: string;
};

type PollDeviceTokenResponse = {
  session_token: string;
  token_type: string;
  expires_in: number;
};

interface StoredAuthToken {
  provider: "convex-device-auth";
  convexUrl: string;
  sessionToken: string;
  tokenType: string;
  issuedAt: string;
  expiresAt: string;
}

const requestDeviceCodeRef = makeFunctionReference<
  "mutation",
  RequestDeviceCodeArgs,
  RequestDeviceCodeResponse
>("deviceAuth:requestDeviceCode");

const pollDeviceTokenRef = makeFunctionReference<
  "mutation",
  PollDeviceTokenArgs,
  PollDeviceTokenResponse
>("deviceAuth:pollDeviceToken");

export interface AuthLoginOptions {
  clientId?: string;
  scope?: string;
}

export async function runAuthLogin(opts: AuthLoginOptions): Promise<void> {
  p.intro("wrapper auth login");
  const convexUrl = resolveConvexUrl();
  if (!convexUrl) {
    p.cancel("Missing Convex URL. Set WRAPPER_CONVEX_URL (or CONVEX_URL) and try again.");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    const result = await client.mutation(requestDeviceCodeRef, {
      clientId: opts.clientId,
      scope: opts.scope,
    });

    trackEvent("auth_device_code_requested");
    log.info("device code issued", {
      userCode: result.user_code,
      expiresIn: result.expires_in,
      interval: result.interval,
    });

    p.note(
      [
        `Code: ${result.user_code}`,
        `Open: ${result.verification_uri_complete}`,
        `Expires in: ${result.expires_in}s`,
        `Poll interval: ${result.interval}s`,
      ].join("\n"),
      "Device Authorization",
    );

    const token = await waitForDeviceToken(client, result);
    persistAuthToken(convexUrl, token);
    trackEvent("auth_device_code_approved");
    p.outro("Device approved. Session token saved.");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    trackError("auth_device_code_request", err);
    log.error("requestDeviceCode failed", { message: err.message });
    p.cancel(`Device authorization failed: ${err.message}`);
    process.exit(1);
  }
}

export async function runAuthWhoami(): Promise<void> {
  p.intro("wrapper auth whoami");
  const auth = loadStoredAuthToken();
  if (!auth) {
    p.cancel("Not logged in. Run `wrapper auth login` first.");
    process.exit(1);
  }

  const expiresAt = Date.parse(auth.expiresAt);
  const expired = Number.isFinite(expiresAt) ? Date.now() >= expiresAt : false;
  trackEvent("auth_whoami_executed", { expired });
  log.info("auth whoami", {
    provider: auth.provider,
    convexUrl: auth.convexUrl,
    expired,
  });

  p.note(
    [
      `Provider: ${auth.provider}`,
      `Convex URL: ${auth.convexUrl}`,
      `Token type: ${auth.tokenType}`,
      `Expires at: ${auth.expiresAt}${expired ? " (expired)" : ""}`,
    ].join("\n"),
    "Current Auth Session",
  );
  p.outro(expired ? "Token is expired. Run `wrapper auth login` again." : "Authenticated.");
}

export async function runAuthLogout(): Promise<void> {
  p.intro("wrapper auth logout");
  const file = paths.authFile();
  if (!existsSync(file)) {
    p.outro("Already logged out.");
    return;
  }

  try {
    unlinkSync(file);
    trackEvent("auth_logout_completed");
    log.info("auth token removed", { file });
    p.outro("Logged out.");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    trackError("auth_logout_failed", err);
    p.cancel(`Logout failed: ${err.message}`);
    process.exit(1);
  }
}

function resolveConvexUrl(): string | null {
  const raw = process.env.WRAPPER_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!raw) return null;
  return raw.trim().replace(/\/+$/, "");
}

async function waitForDeviceToken(
  client: ConvexHttpClient,
  deviceCode: RequestDeviceCodeResponse,
): Promise<PollDeviceTokenResponse> {
  const startedAt = Date.now();
  const expiresAt = startedAt + deviceCode.expires_in * 1_000;
  let intervalMs = Math.max(1_000, deviceCode.interval * 1_000);
  let cancelled = false;
  const signals = installShutdownHandlers({
    onShutdown: () => {
      cancelled = true;
    },
  });

  process.stderr.write("[wrapper] waiting for device approval...\n");
  try {
    while (Date.now() < expiresAt) {
      if (cancelled) {
        process.stderr.write("[wrapper] cancelled.\n");
        process.exit(130);
      }
      // Polling must be sequential to respect device auth interval limits.
      // eslint-disable-next-line no-await-in-loop
      await sleep(intervalMs);
      if (Date.now() >= expiresAt) break;

      try {
        // eslint-disable-next-line no-await-in-loop
        const token = await client.mutation(pollDeviceTokenRef, {
          device_code: deviceCode.device_code,
        });
        return token;
      } catch (error) {
        const message = normalizeErrorMessage(error);
        if (message === "authorization_pending") continue;
        if (message === "slow_down") {
          intervalMs = Math.min(intervalMs + 1_000, 15_000);
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
  } finally {
    signals.dispose();
  }

  throw new Error("Device authorization timed out. Run `wrapper auth login` again.");
}

function persistAuthToken(convexUrl: string, token: PollDeviceTokenResponse): void {
  const now = Date.now();
  const payload: StoredAuthToken = {
    provider: "convex-device-auth",
    convexUrl,
    sessionToken: token.session_token,
    tokenType: token.token_type,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + token.expires_in * 1_000).toISOString(),
  };
  const file = paths.authFile();
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return "unknown_error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadStoredAuthToken(): StoredAuthToken | null {
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
