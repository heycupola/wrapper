import { basename } from "node:path";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { createSessionId } from "@repo/protocol";
import { startAttachClient, type AttachClientHandle } from "../client/attach-client";
import { PtySession } from "../pty/session";
import { registerSession, setSessionShared, unregisterSession } from "../registry/sessions";
import { startLocalServer, type LocalServerHandle } from "../server/local";
import { PrefixFilter, type PrefixCommand } from "../shell/prefix";
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

  let shared = false;
  const sessionTag = sessionId.slice(0, 6);

  function paintRestingTitle(): void {
    setTitle(shared ? `wrapper • shared • ${sessionTag}` : "");
  }

  function announce(title: string, body: string): void {
    log.info(body);
    setTitle(title);
    if (session.isIdle) inlineMessage(body);
    notifyOS("wrapper", body);
  }

  const handlePrefixCommand = (cmd: PrefixCommand): void => {
    switch (cmd) {
      case "share":
        if (shared) {
          announce(`wrapper • shared • ${sessionTag}`, "already shared");
          return;
        }
        shared = true;
        setSessionShared(sessionId, true);
        trackEvent("session_shared");
        announce(`wrapper • shared • ${sessionTag}`, "session shared (relay not wired yet)");
        break;
      case "unshare":
        if (!shared) {
          announce("", "not currently shared");
          return;
        }
        shared = false;
        setSessionShared(sessionId, false);
        trackEvent("session_unshared");
        announce("", "session unshared");
        break;
      case "status":
        announce(
          shared ? `wrapper • shared • ${sessionTag}` : `wrapper • idle • ${sessionTag}`,
          `id=${sessionTag} port=${server.port} shared=${shared ? "yes" : "no"}`,
        );
        break;
      case "detach":
        announce("", "this terminal owns the session — type `exit` to end it");
        break;
    }
  };

  const prefixFilter = new PrefixFilter({
    onCommand: handlePrefixCommand,
    onArmedChange: (armed) => {
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
    clearTitle();
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
    session.once("exit", (code) => resolve(code));
  });

  signals.dispose();
  clearTitle();
  await attach.detach();
  await server.stop();
  unregisterSession(sessionId);

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
