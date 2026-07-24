import { basename } from "node:path";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { createSessionId } from "@repo/protocol";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { startAttachClient, type AttachClientHandle } from "../client/attach-client";
import { PtySession } from "../pty/session";
import { startRelayHostBridge, type RelayHostBridge } from "../relay/host-bridge";
import { registerSession, setSessionShared, unregisterSession } from "../registry/sessions";
import { startLocalServer, type LocalServerHandle } from "../server/local";
import { PrefixFilter, type PrefixCommand } from "../shell/prefix";
import { resolveAuthedConvexClient } from "../util/convex-client";
import { env } from "../util/env";
import { bell, clearTitle, inlineMessage, notifyOS, setTitle } from "../util/feedback";
import { installShutdownHandlers, type ShutdownReason } from "../util/signals";

const log = createLogger("shell-host");

function shellName(path: string): string {
  return basename(path);
}

// Main host process for a wrapped shell session.

export interface ShellHostOptions {
  shell?: string;
  port?: number;
}

const SIGINT_EXIT = 130;
const SIGTERM_EXIT = 143;
const HEARTBEAT_INTERVAL_MS = 15_000;

type SessionOpenArgs = {
  sessionId: string;
  shell: string;
  cwd: string;
  port?: number;
  hostPid?: number;
  shared?: boolean;
};

type SessionHeartbeatArgs = {
  sessionId: string;
  shared?: boolean;
  port?: number;
};

type SessionCloseArgs = {
  sessionId: string;
  reason?: string;
};

type SetRelayStateArgs = {
  sessionId: string;
  relayState: "offline" | "connecting" | "online" | "error";
};

type IssueRelayTicketArgs = {
  sessionId: string;
};

type IssueRelayTicketResponse = {
  ticket: string;
  expiresAt: number;
};

const sessionOpenRef = makeFunctionReference<
  "mutation",
  SessionOpenArgs,
  { id: string; created: boolean }
>("session:open");
const sessionHeartbeatRef = makeFunctionReference<
  "mutation",
  SessionHeartbeatArgs,
  { ok: boolean }
>("session:heartbeat");
const sessionCloseRef = makeFunctionReference<"mutation", SessionCloseArgs, { ok: boolean }>(
  "session:close",
);
const setRelayStateRef = makeFunctionReference<"mutation", SetRelayStateArgs, { ok: boolean }>(
  "session:setRelayState",
);
const issueHostRelayTicketRef = makeFunctionReference<
  "action",
  IssueRelayTicketArgs,
  IssueRelayTicketResponse
>("relay:issueHostTicket");
const createProCheckoutRef = makeFunctionReference<
  "action",
  { successUrl?: string },
  { checkoutUrl: string }
>("billing:createProCheckout");
const setShareCodeRef = makeFunctionReference<
  "mutation",
  { sessionId: string; code?: string },
  { ok: boolean; shared: boolean }
>("session:setShareCode");

// Crockford-style alphabet (no I, L, O, U) so codes are easy to read and type.
const SHARE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Generate a short, human-friendly share code. The owner gives this to whoever
 * they want to let in; the backend stores only its hash. Displayed grouped
 * (XXXX-XXXX) but the backend ignores the dash and case when matching.
 */
function generateShareCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    if (i === 4) code += "-";
    code += SHARE_CODE_ALPHABET[bytes[i]! % SHARE_CODE_ALPHABET.length];
  }
  return code;
}

export async function runShellHost(opts: ShellHostOptions = {}): Promise<void> {
  // Guard against recursive shell-host re-entry.
  if (process.env.WRAPPER_NESTING_GUARD === "1") {
    log.error("shell-host re-entry detected; refusing to spawn inner shell", {
      pid: process.pid,
    });
    process.stderr.write(
      "wrapper: nested shell-host detected; aborting to avoid a fork bomb. " +
        "Make sure your rc hook sets WRAPPER_WRAPPED=1 before exec.\n",
    );
    process.exit(2);
  }

  const sessionId = createSessionId();
  const initialSize = currentSize();

  const session = new PtySession({
    shell: opts.shell,
    size: initialSize,
    env: {
      WRAPPER_WRAPPED: "1",
      WRAPPER_NESTING_GUARD: "1",
    },
  });

  session.on("error", (err) => {
    log.error("pty session error", { sessionId, error: err.message });
    trackError("shell-host", err, { scope: "pty" });
  });

  // PtySession reports spawn failure synchronously via state. Bail out before
  // any further setup so a failed spawn cannot hang the host process.
  if (session.status === "closed") {
    log.error("failed to start shell session", { sessionId });
    process.stderr.write("wrapper: failed to start shell session\n");
    process.exit(1);
  }

  let server: LocalServerHandle;
  try {
    server = startLocalServer({
      port: opts.port ?? 0,
      sessionId,
      pty: session,
    });
  } catch (err) {
    log.error("failed to start local server", {
      port: opts.port,
      error: (err as Error).message,
    });
    trackError("shell-host", err, { scope: "server_start" });
    session.kill();
    process.exit(1);
  }

  const resolvedShell = opts.shell ?? process.env.SHELL ?? "/bin/bash";

  log.info("shell-host started", {
    sessionId,
    pid: session.pid,
    port: server.port,
    shell: resolvedShell,
  });
  trackEvent("shell_host_started", { shell: shellName(resolvedShell) });

  registerSession({
    id: sessionId,
    pid: process.pid,
    port: server.port,
    cwd: process.cwd(),
    shell: resolvedShell,
    createdAt: new Date().toISOString(),
    shared: false,
  });

  const backend = await resolveAuthedConvexClient();
  if (backend.status === "ready") {
    try {
      await backend.client.mutation(sessionOpenRef, {
        sessionId,
        shell: resolvedShell,
        cwd: process.cwd(),
        port: server.port,
        hostPid: process.pid,
        shared: false,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn("failed to open backend session record", { error: err.message });
    }
  } else if (backend.status === "missing_auth") {
    log.debug("convex url configured but no auth token found; backend sync disabled");
  } else if (backend.status === "auth_error") {
    log.warn("backend auth failed; backend sync disabled", { error: backend.error.message });
  }

  let shared = false;
  let shareCode: string | null = null;
  let relayBridge: RelayHostBridge | null = null;
  // Guards against a second `share` press racing the in-flight relay setup
  // (we no longer optimistically flip `shared` to serve as that guard).
  let relayStarting = false;
  const sessionTag = sessionId.slice(0, 6);

  function printShareInvite(): void {
    if (!shareCode) return;
    const lines = [
      `share code: ${shareCode}`,
      `others join with: wrapper attach --relay --id ${sessionId} --code ${shareCode}`,
    ];
    if (session.isIdle) {
      for (const line of lines) inlineMessage(line);
    } else {
      for (const line of lines) log.info(line);
    }
  }
  const heartbeat = setInterval(() => {
    if (backend.status !== "ready") return;
    void backend.client
      .mutation(sessionHeartbeatRef, {
        sessionId,
        shared,
        port: server.port,
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn("session heartbeat failed", { error: err.message });
      });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  function paintRestingTitle(): void {
    if (!env.hudEnabled) return;
    setTitle(shared ? `wrapper • shared • ${sessionTag}` : "");
  }

  function announce(title: string, body: string): void {
    log.info(body);
    if (env.hudEnabled) {
      setTitle(title);
    }
    if (session.isIdle) inlineMessage(body);
    if (env.hudEnabled) {
      notifyOS("wrapper", body);
    }
  }

  // Mark the session as shared. Only called once sharing actually takes effect
  // (relay bridge up, or a local-only fallback) — never on a denied share — so
  // the title/registry/analytics never claim "shared" when the user can't share.
  function commitShared(): void {
    shared = true;
    setSessionShared(sessionId, true);
    trackEvent("session_shared");
  }

  const startRelayBridge = async (): Promise<void> => {
    if (relayBridge || relayStarting) return;

    if (backend.status !== "ready") {
      // Local-only share (no relay); allowed without a Pro plan.
      commitShared();
      announce(
        `wrapper • shared • ${sessionTag}`,
        "session shared locally (relay unavailable: login/backend required)",
      );
      return;
    }

    relayStarting = true;
    const code = generateShareCode();
    try {
      // Persist the shared flag and the access-code hash before issuing the relay
      // ticket so viewer authorization is synchronized rather than racing the
      // periodic fire-and-forget heartbeat. Only the code hash is stored.
      await backend.client.mutation(setShareCodeRef, { sessionId, code });
      await backend.client.mutation(setRelayStateRef, { sessionId, relayState: "connecting" });
      const issued = await backend.client.action(issueHostRelayTicketRef, { sessionId });
      relayBridge = startRelayHostBridge({
        relayUrl: env.relayUrl,
        ticket: issued.ticket,
        sessionId,
        pty: session,
        enableP2P: env.p2pEnabled,
        onOpen: () => {
          if (backend.status !== "ready") return;
          void backend.client
            .mutation(setRelayStateRef, { sessionId, relayState: "online" })
            .catch(() => {});
        },
        onClose: () => {
          if (backend.status !== "ready") return;
          void backend.client
            .mutation(setRelayStateRef, { sessionId, relayState: "offline" })
            .catch(() => {});
        },
        onError: () => {
          if (backend.status !== "ready") return;
          void backend.client
            .mutation(setRelayStateRef, { sessionId, relayState: "error" })
            .catch(() => {});
        },
      });
      shareCode = code;
      commitShared();
      announce(`wrapper • shared • ${sessionTag}`, "session shared via relay");
      printShareInvite();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await backend.client
        .mutation(setRelayStateRef, { sessionId, relayState: "error" })
        .catch(() => {});

      if (isProPlanRequiredError(err.message)) {
        // Expected outcome for free users. `shared` is never committed until a
        // share succeeds, so nothing to roll back locally — just undo the backend
        // heartbeat we sent before the ticket, and show a clean upgrade prompt
        // (with a retry hint) instead of dumping the raw server error.
        log.debug("relay share denied (Pro required)", { error: err.message });
        await backend.client.mutation(setShareCodeRef, { sessionId }).catch(() => {});
        if (env.hudEnabled) setTitle("");

        const checkoutUrl = await fetchProCheckoutUrl(backend.client);
        const lines = checkoutUrl
          ? [
              "Relay sharing requires Pro.",
              `Upgrade → ${checkoutUrl}`,
              "Once upgraded, press Ctrl+\\ then s to share (no restart needed).",
            ]
          : [
              "Relay sharing requires Pro — upgrade your plan,",
              "then press Ctrl+\\ then s to try again.",
            ];
        if (session.isIdle) {
          for (const line of lines) inlineMessage(line);
        } else {
          for (const line of lines) log.info(line);
        }
        if (env.hudEnabled) notifyOS("wrapper", "Relay sharing requires Pro");
        return;
      }

      // Unexpected failure (e.g. relay unreachable): keep the diagnostic warning
      // and fall back to a local-only share.
      log.warn("failed to start relay bridge", { error: err.message });
      commitShared();
      announce(
        `wrapper • shared • ${sessionTag}`,
        "session shared locally (relay connect failed; check logs/auth)",
      );
    } finally {
      relayStarting = false;
    }
  };

  const stopRelayBridge = async (): Promise<void> => {
    if (!relayBridge) return;
    const bridge = relayBridge;
    relayBridge = null;
    await bridge.stop();
    if (backend.status === "ready") {
      await backend.client
        .mutation(setRelayStateRef, { sessionId, relayState: "offline" })
        .catch(() => {});
    }
  };

  const handlePrefixCommand = (cmd: PrefixCommand): void => {
    switch (cmd) {
      case "share":
        if (shared) {
          announce(`wrapper • shared • ${sessionTag}`, "already shared");
          return;
        }
        // `shared` is committed inside startRelayBridge only once the share
        // actually takes effect, so a denied relay share (e.g. no Pro plan)
        // never leaves the session marked as shared.
        void startRelayBridge();
        break;
      case "unshare":
        if (!shared) {
          announce("", "not currently shared");
          return;
        }
        shared = false;
        shareCode = null;
        setSessionShared(sessionId, false);
        trackEvent("session_unshared");
        if (backend.status === "ready") {
          // Clears both `shared` and the stored code hash, revoking any
          // outstanding viewer access immediately.
          void backend.client.mutation(setShareCodeRef, { sessionId }).catch(() => {});
        }
        void stopRelayBridge();
        announce("", "session unshared");
        break;
      case "status":
        announce(
          shared ? `wrapper • shared • ${sessionTag}` : `wrapper • idle • ${sessionTag}`,
          `id=${sessionTag} port=${server.port} shared=${shared ? "yes" : "no"}${
            shared && shareCode ? ` code=${shareCode}` : ""
          }`,
        );
        break;
      case "detach":
        announce("", "this terminal owns the session — type `exit` to end it");
        break;
    }
  };

  const prefixFilter = new PrefixFilter({
    onCommand: handlePrefixCommand,
    onForward: (data) => session.write(data),
    onArmedChange: (armed) => {
      if (!env.hudEnabled) return;
      if (armed) {
        setTitle(`● wrapper armed • ${sessionTag}`);
        bell();
      } else {
        paintRestingTitle();
      }
    },
  });

  // Reuse attach-client path so host and viewer go through same protocol.

  const url = `ws://127.0.0.1:${server.port}`;
  const attach: AttachClientHandle = startAttachClient({
    url,
    initialSize,
    connectRetries: 20,
    connectRetryDelayMs: 50,
    interceptStdin: (chunk) => prefixFilter.process(chunk),
  });

  let shuttingDown = false;
  const shutdown = async (reason: ShutdownReason): Promise<number> => {
    if (shuttingDown) return 0;
    shuttingDown = true;
    log.debug("shell-host shutting down", { sessionId, reason });
    clearInterval(heartbeat);
    await stopRelayBridge();
    if (backend.status === "ready") {
      try {
        await backend.client.mutation(sessionCloseRef, {
          sessionId,
          reason,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn("failed to close backend session record", { error: err.message });
      }
    }
    if (env.hudEnabled) {
      clearTitle();
    }
    await attach.detach();
    await server.stop();
    session.kill();
    unregisterSession(sessionId);
    return reason === "SIGINT" ? SIGINT_EXIT : reason === "SIGTERM" ? SIGTERM_EXIT : 0;
  };

  const signals = installShutdownHandlers({
    onShutdown: async (reason) => {
      const code = await shutdown(reason);
      process.exit(code);
    },
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    // Guard against a session that already exited during setup, otherwise the
    // late `once("exit")` listener would never fire and the host would hang.
    if (session.status === "closed") {
      resolve(session.lastExitCode);
      return;
    }
    session.once("exit", (code) => resolve(code));
  });

  signals.dispose();
  await shutdown("exit");

  log.info("shell-host ended", { sessionId, exitCode });
  trackEvent("shell_host_ended", { exitCode: exitCode ?? null });
  process.exit(exitCode ?? 0);
}

function currentSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

function isProPlanRequiredError(message: string): boolean {
  return message.includes("Relay sharing requires Pro plan");
}

async function fetchProCheckoutUrl(client: ConvexHttpClient): Promise<string | null> {
  try {
    const result = await client.action(createProCheckoutRef, {});
    return result.checkoutUrl.length > 0 ? result.checkoutUrl : null;
  } catch (error) {
    log.warn("failed to create pro checkout link", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
