import { basename } from "node:path";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import pc from "picocolors";
import { createSessionId } from "@repo/protocol";
import type { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { startAttachClient, type AttachClientHandle } from "../client/attach-client";
import { PtySession } from "../pty/session";
import { startRelayHostBridge, type RelayHostBridge } from "../relay/host-bridge";
import { registerSession, setSessionShared, unregisterSession } from "../registry/sessions";
import { startLocalServer, type LocalServerHandle } from "../server/local";
import { createDoorbellParser, scanDoorbell } from "../shell/doorbell";
import { PrefixFilter, type PrefixCommand } from "../shell/prefix";
import {
  resolveAuthedConvexClient,
  startAuthAutoRefresh,
  type AuthAutoRefresh,
} from "../util/convex-client";
import { convexErrorPayload, isProPlanRequiredError } from "../util/convex-error";
import { createEnterToOpen } from "../util/enter-to-open";
import { env } from "../util/env";
import { openUrl } from "../util/open-url";
import { resolvePrefix } from "../util/prefix-config";
import { formatShareCode } from "../util/ui";
import {
  bell,
  clearTitle,
  formatControlsHint,
  formatSessionHud,
  inlineMessage,
  notifyOS,
  setTitle,
  type SessionTransportStatus,
} from "../util/feedback";
import { installShutdownHandlers, type ShutdownReason } from "../util/signals";

const log = createLogger("shell-host");

function shellName(path: string): string {
  return basename(path);
}

// Main host process for a wrapped shell session.

export interface ShellHostOptions {
  shell?: string;
  /** Spawn this argv instead of an interactive shell. */
  argv?: string[];
  port?: number;
  /** After the host is up, share immediately (`wrapper share`). */
  shareOnStart?: boolean;
  /** When sharing, allow people who join with the code to type. Default: watch only. */
  writableOnStart?: boolean;
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
  { successUrl?: string; interval?: "month" | "year" },
  { checkoutUrl: string }
>("billing:createProCheckout");
const setShareCodeRef = makeFunctionReference<
  "mutation",
  { sessionId: string; code?: string; guestInput?: boolean },
  { ok: boolean; shared: boolean }
>("session:setShareCode");
const setGuestInputRef = makeFunctionReference<
  "mutation",
  { sessionId: string; guestInput: boolean },
  { ok: boolean; guestInput: boolean }
>("session:setGuestInput");
const reportAttentionRef = makeFunctionReference<
  "mutation",
  { sessionId: string; kind: "bell" | "manual" },
  { ok: boolean; sent?: boolean }
>("push:reportAttention");

/** 256-bit hex secret gating connections to the local WebSocket server. */
function createLocalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

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
  const prefix = resolvePrefix();
  // Guard against recursive shell-host re-entry.
  if (process.env.WRAPPER_NESTING_GUARD === "1") {
    log.error("shell-host re-entry detected; refusing to spawn inner shell", {
      pid: process.pid,
    });
    process.stderr.write(
      "wrapper: nested shell-host detected; aborting to avoid a fork bomb. " +
        "Make sure wrapper install sets WRAPPER_WRAPPED=1 before exec.\n",
    );
    process.exit(2);
  }

  const sessionId = createSessionId();
  const localToken = createLocalToken();
  const initialSize = currentSize();

  const session = new PtySession({
    shell: opts.shell,
    argv: opts.argv,
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
      token: localToken,
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

  const resolvedShell =
    opts.argv && opts.argv.length > 0
      ? opts.argv.join(" ")
      : (opts.shell ?? process.env.SHELL ?? "/bin/bash");

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
    localToken,
  });

  const backend = await resolveAuthedConvexClient();
  if (backend.status === "missing_auth") {
    log.debug("convex url configured but no auth token found; backend sync disabled");
  } else if (backend.status === "auth_error") {
    log.warn("backend auth failed; backend sync disabled", { error: backend.error.message });
  }

  // Keep the short-lived Convex JWT fresh so a later share still works. Tokens
  // are not session metadata; cwd/shell/pid stay off Convex until share.
  let authRefresh: AuthAutoRefresh | null = null;
  if (backend.status === "ready") {
    authRefresh = startAuthAutoRefresh({
      client: backend.client,
      convexUrl: backend.convexUrl,
      sessionToken: backend.sessionToken,
      jwt: backend.jwt,
      log,
    });
  }

  let shared = false;
  /** Bumped on share, unshare, and shutdown so in-flight async work can bail. */
  let shareOp = 0;
  let shuttingDown = false;
  let shareCode: string | null = null;
  let relayBridge: RelayHostBridge | null = null;
  let relayConnected = false;
  let p2pPeerCount = 0;
  let shareInviteTimer: ReturnType<typeof setTimeout> | null = null;
  // Guards against a second `share` press racing the in-flight relay setup
  // (we no longer optimistically flip `shared` to serve as that guard).
  let relayStarting = false;
  let guestInputAllowed = Boolean(opts.writableOnStart);
  let lastOwnerInputAt = 0;
  let lastNotifyAt = 0;
  const doorbell = createDoorbellParser();
  const sessionTag = sessionId.slice(0, 6);
  const ATTENTION_DEBOUNCE_MS = 30_000;
  const OWNER_INPUT_GRACE_MS = 5_000;
  const checkoutOpen = createEnterToOpen({
    open: openUrl,
    onOpened: (ok) => {
      if (ok) return;
      const message = "Could not open the browser. Open the URL above.";
      if (session.isIdle) inlineMessage(message);
      else log.warn(message);
    },
  });

  session.on("data", (chunk) => {
    if (!env.notifyEnabled) return;
    if (!scanDoorbell(chunk, doorbell)) return;
    const now = Date.now();
    if (now - lastOwnerInputAt < OWNER_INPUT_GRACE_MS) return;
    if (now - lastNotifyAt < ATTENTION_DEBOUNCE_MS) return;
    lastNotifyAt = now;
    notifyOS("wrapper", `Session ${sessionTag} needs you.`);
    if (backend.status !== "ready") return;
    void backend.client
      .mutation(reportAttentionRef, { sessionId, kind: "bell" })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        log.debug("attention ping failed", { error: err.message });
      });
  });

  function guestAccess(): "view" | "rw" | undefined {
    if (!shared && !relayStarting) return undefined;
    return guestInputAllowed ? "rw" : "view";
  }

  function printShareInvite(attempt = 0): void {
    shareInviteTimer = null;
    if (!shareCode) return;
    if (session.isIdle) {
      inlineMessage(`share code  ${pc.bold(pc.green(formatShareCode(shareCode)))}`);
      inlineMessage(`join        ${pc.cyan(`wrapper attach --relay --id ${sessionId}`)}`);
      inlineMessage(
        pc.dim(
          guestInputAllowed
            ? `guests can type · ${prefix.label} then w for watch-only`
            : `guests watch only · ${prefix.label} then w to allow typing`,
        ),
      );
      return;
    }
    // Never put the capability in logs. If a TUI owns the terminal, wait until
    // the next idle prompt so the code appears only in the host's terminal.
    if (attempt >= 120) {
      notifyOS("wrapper", "Session shared. Return to the shell prompt to view the share code.");
      return;
    }
    shareInviteTimer = setTimeout(() => printShareInvite(attempt + 1), 500);
    shareInviteTimer.unref?.();
  }
  let cloudOpened = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  function startHeartbeat(): void {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      if (backend.status !== "ready" || !cloudOpened) return;
      void backend.client
        .mutation(sessionHeartbeatRef, {
          sessionId,
          shared,
          port: server.port,
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          if (/InvalidAuthHeader|expired|Unauthenticated/i.test(err.message)) {
            void authRefresh?.refreshNow();
          }
          log.warn("session heartbeat failed", { error: err.message });
        });
    }, HEARTBEAT_INTERVAL_MS);
    heartbeat.unref();
  }

  function stopHeartbeat(): void {
    if (!heartbeat) return;
    clearInterval(heartbeat);
    heartbeat = null;
  }

  async function ensureCloudSession(): Promise<boolean> {
    if (backend.status !== "ready") return false;
    if (cloudOpened) return true;
    try {
      await backend.client.mutation(sessionOpenRef, {
        sessionId,
        shell: resolvedShell,
        cwd: process.cwd(),
        port: server.port,
        hostPid: process.pid,
        shared: false,
      });
      cloudOpened = true;
      startHeartbeat();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn("failed to open backend session record", { error: err.message });
      return false;
    }
  }

  async function closeCloudSession(reason: string): Promise<void> {
    if (!cloudOpened || backend.status !== "ready") {
      cloudOpened = false;
      stopHeartbeat();
      return;
    }
    cloudOpened = false;
    stopHeartbeat();
    try {
      await backend.client.mutation(sessionCloseRef, { sessionId, reason });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn("failed to close backend session record", { error: err.message });
    }
  }

  function currentTransport(): SessionTransportStatus {
    if (relayStarting && !shared) return "sharing";
    if (!shared) return "local";
    if (relayStarting) return "connecting";
    if (!relayBridge) return "local";
    if (p2pPeerCount > 0) return "p2p";
    return relayConnected ? "relay" : "offline";
  }

  function paintRestingTitle(): void {
    if (!env.hudEnabled) return;
    setTitle(
      formatSessionHud({
        role: "host",
        sessionTag,
        transport: currentTransport(),
        p2pPeerCount,
        guestAccess: guestAccess(),
      }),
    );
  }

  function announce(_title: string, body: string): void {
    log.info(body);
    paintRestingTitle();
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

  function shareAbandoned(op: number): boolean {
    return shuttingDown || op !== shareOp;
  }

  const startRelayBridge = async (): Promise<void> => {
    // `relayStarting` is flipped by the share command before this runs, so a
    // second prefix+s cannot race the in-flight setup. Always clear it here.
    const op = shareOp;
    try {
      if (relayBridge) return;
      if (shareAbandoned(op)) return;

      if (backend.status !== "ready") {
        // Local-only share (no relay); allowed without a Pro plan.
        if (shareAbandoned(op)) return;
        commitShared();
        announce(
          `wrapper • shared • ${sessionTag}`,
          "session shared locally (relay unavailable: login/backend required)",
        );
        return;
      }

      paintRestingTitle();
      const opened = await ensureCloudSession();
      if (shareAbandoned(op)) {
        if (shuttingDown) await closeCloudSession("shutdown");
        return;
      }
      if (!opened) {
        announce(
          `wrapper • shared • ${sessionTag}`,
          "session shared locally (relay unavailable: could not open backend session)",
        );
        commitShared();
        return;
      }
      const code = generateShareCode();
      try {
        // Persist the shared flag and the access-code hash before issuing the relay
        // ticket so viewer authorization is synchronized rather than racing the
        // periodic fire-and-forget heartbeat. Only the code hash is stored.
        await backend.client.mutation(setShareCodeRef, {
          sessionId,
          code,
          guestInput: guestInputAllowed,
        });
        if (shareAbandoned(op)) return;
        await backend.client.mutation(setRelayStateRef, { sessionId, relayState: "connecting" });
        if (shareAbandoned(op)) return;
        const issued = await backend.client.action(issueHostRelayTicketRef, { sessionId });
        if (shareAbandoned(op)) return;
        relayBridge = startRelayHostBridge({
          relayUrl: env.relayUrl,
          ticket: issued.ticket,
          sessionId,
          pty: session,
          enableP2P: env.p2pEnabled,
          onTransportChange: (state) => {
            relayConnected = state.relayConnected;
            p2pPeerCount = state.p2pPeerCount;
            paintRestingTitle();
          },
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
        if (shareAbandoned(op)) return;
        shareCode = code;
        commitShared();
        announce(`wrapper • shared • ${sessionTag}`, "session shared via relay");
        printShareInvite();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const payload = convexErrorPayload(error);
        await backend.client
          .mutation(setRelayStateRef, { sessionId, relayState: "error" })
          .catch(() => {});

        if (isProPlanRequiredError(error)) {
          // Expected outcome for free users. `shared` is never committed until a
          // share succeeds, so nothing to roll back locally — just undo the backend
          // heartbeat we sent before the ticket, and show a clean upgrade prompt
          // (with a retry hint) instead of dumping the raw server error.
          log.debug("relay share denied (Pro required)", {
            error: err.message,
            code: payload.code,
            detail: payload.message,
          });
          await backend.client.mutation(setShareCodeRef, { sessionId }).catch(() => {});
          await closeCloudSession("pro_required");
          if (env.hudEnabled) setTitle("");

          const inputAtBeforeCheckout = lastOwnerInputAt;
          const checkoutUrl = await fetchProCheckoutUrl(backend.client);
          const typedDuringWait = lastOwnerInputAt !== inputAtBeforeCheckout;
          const armCheckout = Boolean(checkoutUrl) && session.isIdle && !typedDuringWait;
          const lines = checkoutUrl
            ? [
                "Relay sharing requires Pro.",
                `Upgrade → ${checkoutUrl}`,
                ...(armCheckout ? ["Press Enter to open the browser"] : []),
                `Once upgraded, press ${prefix.label} then s to share (no restart needed).`,
              ]
            : [
                "Relay sharing requires Pro — upgrade your plan,",
                `then press ${prefix.label} then s to try again.`,
              ];
          if (session.isIdle) {
            for (const line of lines) inlineMessage(line);
            if (armCheckout && checkoutUrl) checkoutOpen.arm(checkoutUrl);
          } else {
            for (const line of lines) log.info(line);
          }
          if (env.hudEnabled) notifyOS("wrapper", "Relay sharing requires Pro");
          return;
        }

        // Unexpected failure (e.g. relay unreachable): keep the diagnostic warning
        // and fall back to a local-only share.
        log.warn("failed to start relay bridge", {
          error: err.message,
          code: payload.code,
          detail: payload.message,
        });
        commitShared();
        announce(
          `wrapper • shared • ${sessionTag}`,
          "session shared locally (relay connect failed; check logs/auth)",
        );
      }
    } finally {
      relayStarting = false;
      paintRestingTitle();
    }
  };

  const stopRelayBridge = async (): Promise<void> => {
    if (!relayBridge) return;
    const bridge = relayBridge;
    relayBridge = null;
    relayConnected = false;
    p2pPeerCount = 0;
    paintRestingTitle();
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
        if (relayStarting) {
          announce(`wrapper • sharing • ${sessionTag}`, "already sharing…");
          return;
        }
        checkoutOpen.disarm();
        // `shared` is committed inside startRelayBridge only once the share
        // actually takes effect, so a denied relay share (e.g. no Pro plan)
        // never leaves the session marked as shared. Flip `relayStarting`
        // synchronously so a second prefix+s cannot race the in-flight setup.
        // Bump `shareOp` so an in-flight unshare cannot close the new share.
        shareOp += 1;
        relayStarting = true;
        paintRestingTitle();
        announce(`wrapper • sharing • ${sessionTag}`, "sharing…");
        void startRelayBridge();
        break;
      case "unshare":
        if (relayStarting) {
          announce(`wrapper • sharing • ${sessionTag}`, "still sharing…");
          return;
        }
        if (!shared) {
          announce("", "not currently shared");
          return;
        }
        shared = false;
        shareCode = null;
        if (shareInviteTimer) clearTimeout(shareInviteTimer);
        shareInviteTimer = null;
        setSessionShared(sessionId, false);
        trackEvent("session_unshared");
        const unshareOp = ++shareOp;
        void (async () => {
          await stopRelayBridge();
          if (unshareOp !== shareOp) return;
          if (backend.status === "ready") {
            await backend.client.mutation(setShareCodeRef, { sessionId }).catch(() => {});
          }
          if (unshareOp !== shareOp) return;
          await closeCloudSession("unshared");
        })();
        announce("", "session unshared");
        break;
      case "typing":
        if (relayStarting) {
          announce(`wrapper • sharing • ${sessionTag}`, "still sharing…");
          return;
        }
        if (!shared) {
          announce("", "share first, then allow typing");
          return;
        }
        guestInputAllowed = !guestInputAllowed;
        relayBridge?.setGuestInput(guestInputAllowed);
        if (backend.status === "ready") {
          void backend.client
            .mutation(setGuestInputRef, { sessionId, guestInput: guestInputAllowed })
            .catch((error: unknown) => {
              const err = error instanceof Error ? error : new Error(String(error));
              log.warn("failed to update guest typing", { error: err.message });
            });
        }
        announce(
          "",
          guestInputAllowed
            ? "people you invite can type"
            : "people you invite can watch, not type",
        );
        break;
      case "status":
        announce(
          shared ? `wrapper • shared • ${sessionTag}` : `wrapper • idle • ${sessionTag}`,
          `id=${sessionTag} port=${server.port} shared=${shared ? "yes" : relayStarting ? "sharing" : "no"} transport=${currentTransport()} typing=${guestInputAllowed ? "allowed" : "watch-only"}`,
        );
        break;
      case "detach":
        announce("", "this terminal owns the session — type `exit` to end it");
        break;
    }
  };

  const prefixFilter = new PrefixFilter({
    prefix: prefix.byte,
    onCommand: handlePrefixCommand,
    onForward: (data) => {
      lastOwnerInputAt = Date.now();
      session.write(data);
    },
    onArmedChange: (armed) => {
      if (!env.hudEnabled) return;
      if (armed) {
        setTitle(
          formatSessionHud({
            role: "host",
            sessionTag,
            transport: currentTransport(),
            p2pPeerCount,
            armed: true,
            guestAccess: guestAccess(),
          }),
        );
        bell();
      } else {
        paintRestingTitle();
      }
    },
  });
  paintRestingTitle();

  // Reuse attach-client path so host and viewer go through same protocol.

  const url = `ws://127.0.0.1:${server.port}?token=${localToken}`;
  const attach: AttachClientHandle = startAttachClient({
    url,
    initialSize,
    connectRetries: 20,
    connectRetryDelayMs: 50,
    interceptStdin: (chunk) => {
      const afterPrefix = prefixFilter.process(chunk);
      const passthrough = checkoutOpen.process(afterPrefix);
      if (passthrough.length > 0) lastOwnerInputAt = Date.now();
      return passthrough;
    },
    onTerminalTitle: paintRestingTitle,
  });

  // Print the control discovery hint once the shell reaches an idle prompt. We
  // never write it while a foreground program owns the terminal, so a slow shell
  // startup or a full-screen TUI cannot be corrupted.
  let controlsHintTimer: ReturnType<typeof setTimeout> | null = null;
  let controlsHintAttempts = 0;
  const showControlsHint = (): void => {
    controlsHintTimer = null;
    if (session.isIdle) {
      inlineMessage(formatControlsHint("host", prefix.label));
      paintRestingTitle();
      return;
    }
    controlsHintAttempts += 1;
    if (controlsHintAttempts >= 20) return;
    controlsHintTimer = setTimeout(showControlsHint, 250);
    controlsHintTimer.unref?.();
  };
  controlsHintTimer = setTimeout(showControlsHint, 500);
  controlsHintTimer.unref?.();

  if (opts.shareOnStart) {
    handlePrefixCommand("share");
  }

  const shutdown = async (reason: ShutdownReason): Promise<number> => {
    if (shuttingDown) return 0;
    shuttingDown = true;
    shareOp += 1;
    checkoutOpen.disarm();
    log.debug("shell-host shutting down", { sessionId, reason });
    stopHeartbeat();
    if (shareInviteTimer) clearTimeout(shareInviteTimer);
    if (controlsHintTimer) clearTimeout(controlsHintTimer);
    authRefresh?.stop();
    await stopRelayBridge();
    await closeCloudSession(reason);
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

async function fetchProCheckoutUrl(client: ConvexHttpClient): Promise<string | null> {
  try {
    const result = await client.action(createProCheckoutRef, { interval: "year" });
    return result.checkoutUrl.length > 0 ? result.checkoutUrl : null;
  } catch (error) {
    log.warn("failed to create pro checkout link", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
