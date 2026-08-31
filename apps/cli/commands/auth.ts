import * as p from "@clack/prompts";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { type StoredAuthToken, loadStoredAuthToken, resolveConvexUrl } from "../util/auth-session";
import { resolveConvexSiteUrl } from "../util/convex-client";
import { DeviceAuthPollingCancelledError, pollForDeviceToken } from "../util/device-auth-poll";
import { openUrl } from "../util/open-url";
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

type PollDeviceTokenSuccess = {
  session_token: string;
  token_type: string;
  expires_in: number;
};
type PollDeviceTokenResponse = PollDeviceTokenSuccess | { error: string };

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

    const openBrowser = await p.confirm({
      message: "Press Enter to open the browser",
      initialValue: true,
    });
    if (p.isCancel(openBrowser)) {
      p.cancel("Device authorization cancelled.");
      process.exit(130);
    }
    if (openBrowser && !openUrl(result.verification_uri_complete)) {
      p.log.warn("Could not open the browser. Open the URL above.");
    }

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

  let serverRevoked = false;
  const stored = loadStoredAuthToken();
  if (stored) {
    try {
      const response = await fetch(`${resolveConvexSiteUrl(stored.convexUrl)}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${stored.sessionToken}`,
          "content-type": "application/json",
        },
        body: "{}",
      });
      serverRevoked = response.ok;
      if (!response.ok) {
        log.warn("server session revocation failed during logout", { status: response.status });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn("server session revocation failed during logout", { error: err.message });
    }
  }

  try {
    unlinkSync(file);
    trackEvent("auth_logout_completed");
    log.info("auth token removed", { file });
    p.outro(
      serverRevoked
        ? "Logged out and revoked the server session."
        : "Local session removed. Server revocation could not be confirmed.",
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    trackError("auth_logout_failed", err);
    p.cancel(`Logout failed: ${err.message}`);
    process.exit(1);
  }
}

async function waitForDeviceToken(
  client: ConvexHttpClient,
  deviceCode: RequestDeviceCodeResponse,
): Promise<PollDeviceTokenSuccess> {
  let cancelled = false;
  const signals = installShutdownHandlers({
    onShutdown: () => {
      cancelled = true;
    },
  });

  process.stderr.write("[wrapper] waiting for device approval...\n");
  try {
    try {
      return await pollForDeviceToken({
        expiresInSeconds: deviceCode.expires_in,
        intervalSeconds: deviceCode.interval,
        isCancelled: () => cancelled,
        // pollForDeviceToken awaits each call before scheduling the next one.
        poll: async () => {
          const result = await client.mutation(pollDeviceTokenRef, {
            device_code: deviceCode.device_code,
          });
          if ("error" in result) throw new Error(result.error);
          return result;
        },
      });
    } catch (error) {
      if (error instanceof DeviceAuthPollingCancelledError) {
        process.stderr.write("[wrapper] cancelled.\n");
        process.exit(130);
      }
      throw error;
    }
  } finally {
    signals.dispose();
  }
}

function persistAuthToken(convexUrl: string, token: PollDeviceTokenSuccess): void {
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
