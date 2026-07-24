import * as p from "@clack/prompts";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { makeFunctionReference } from "convex/server";
import { startAttachClient } from "../client/attach-client";
import {
  findSession,
  findSessionByPort,
  latestSession,
  listSessions,
  type SessionRecord,
} from "../registry/sessions";
import { PrefixFilter, type PrefixCommand } from "../shell/prefix";
import { resolveAuthedConvexClient } from "../util/convex-client";
import { env } from "../util/env";
import { bell, clearTitle, inlineMessage, setTitle } from "../util/feedback";
import { installShutdownHandlers } from "../util/signals";

const log = createLogger("attach");

type AuthorizeAttachArgs = {
  sessionId: string;
};

type AuthorizeAttachResponse = {
  ok: boolean;
  sessionId: string;
  port?: number;
  shared: boolean;
  isOwner: boolean;
  updatedAt: number;
};

type IssueViewerTicketArgs = {
  sessionId: string;
  code?: string;
};

type IssueViewerTicketResponse = {
  ticket: string;
  expiresAt: number;
};

const authorizeAttachRef = makeFunctionReference<
  "query",
  AuthorizeAttachArgs,
  AuthorizeAttachResponse
>("session:authorizeAttach");
const issueViewerRelayTicketRef = makeFunctionReference<
  "mutation",
  IssueViewerTicketArgs,
  IssueViewerTicketResponse
>("relay:issueViewerTicket");

/**
 * `wrapper attach` — connect a viewer terminal to a running session.
 *
 * Resolution order for the target session:
 *   1. `--id <sessionId>` if provided.
 *   2. `--port <number>` if provided (skips registry).
 *   3. Single live registry entry → use it.
 *   4. Multiple live entries → interactive picker.
 *   5. No live entries → fail with a hint.
 *
 * The client speaks the same wire protocol the relay/mobile app will use,
 * so debugging the local case validates the remote case.
 */

export interface AttachOptions {
  id?: string;
  port?: number;
  host?: string;
  relay?: boolean;
  code?: string;
}

const SIGINT_EXIT = 130;

export async function runAttach(opts: AttachOptions): Promise<void> {
  const host = opts.host ?? "127.0.0.1";

  const target = await resolveTarget(opts);
  if (!target) process.exit(2);
  const url = await resolveAttachUrl({
    host,
    target,
    preferRelay: Boolean(opts.relay),
    code: opts.code,
  });
  if (!url) process.exit(1);
  // Relay URLs carry a single-use join ticket in the query string. Redact it so
  // the credential never lands in the log file or the terminal scrollback.
  const safeUrl = url.replace(/ticket=[^&]+/, "ticket=***");
  log.info("attaching", { url: safeUrl, sessionId: target.id });
  trackEvent("attach_started");
  process.stderr.write(`[wrapper] attaching to ${safeUrl}\n`);
  process.stderr.write(`[wrapper] press Ctrl+\\ then 'd' to detach (session keeps running)\n`);

  let userAborted = false;
  const sessionTag = target.id.slice(0, 6);

  /*
   * Wrapper's keystroke prefix on the attach side. The host has its
   * own filter for share/unshare; here we expose only the actions
   * that make sense for a viewer:
   *
   *   Ctrl+\ d   — disconnect this viewer (session keeps running)
   *   Ctrl+\ ?   — quick status to stderr
   *
   * `share`, `unshare` etc. arrive too but are ignored: paylaşımı
   * sadece host kontrol eder.
   */
  const handlePrefixCommand = (cmd: PrefixCommand): void => {
    switch (cmd) {
      case "detach":
        userAborted = true;
        log.info("detach requested via prefix", { sessionId: target.id });
        trackEvent("attach_detach_keystroke");
        // Title back to normal before we close the socket so the
        // "● wrapper armed" overlay doesn't outlive the viewer.
        clearTitle();
        void handle.detach();
        break;
      case "status":
        inlineMessage(`viewing ${sessionTag} on port ${target.port}`);
        setTitle(`wrapper • viewer • ${sessionTag}`);
        break;
      case "share":
      case "unshare":
        // Viewer cannot publish a session it doesn't own. Bell-only
        // hint so the user knows the keystroke landed somewhere.
        inlineMessage("only the session host can share/unshare");
        bell();
        break;
    }
  };

  const prefixFilter = new PrefixFilter({
    onCommand: handlePrefixCommand,
    onForward: (data) => handle.forwardInput(data),
    onArmedChange: (armed) => {
      if (armed) {
        setTitle(`● wrapper armed • viewer • ${sessionTag}`);
        bell();
      } else {
        setTitle(`wrapper • viewer • ${sessionTag}`);
      }
    },
  });

  // P2P applies only to relay attaches (remote peers); local 127.0.0.1 attaches
  // are already direct. Relay URLs carry the `/ws?ticket=` path.
  const usingRelay = url.includes("/ws?ticket=");
  const handle = startAttachClient({
    url,
    initialSize: {
      cols: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    },
    connectRetries: 5,
    connectRetryDelayMs: 100,
    interceptStdin: (chunk) => prefixFilter.process(chunk),
    p2p: env.p2pEnabled && usingRelay ? { sessionId: target.id } : undefined,
  });

  // Initial title so the user sees this is a viewer window.
  setTitle(`wrapper • viewer • ${sessionTag}`);

  const signals = installShutdownHandlers({
    onShutdown: async () => {
      userAborted = true;
      clearTitle();
      await handle.detach();
    },
  });

  const result = await handle.done;
  signals.dispose();
  // Always restore the title — every exit branch below ends the viewer.
  clearTitle();

  if (userAborted) {
    log.info("detached by user");
    trackEvent("attach_ended", { reason: "user_aborted" });
    process.exit(SIGINT_EXIT);
  }
  if (result.reason === "error" && result.error) {
    log.error("attach failed", { error: result.error.message });
    trackError("attach", result.error);
    process.stderr.write(`[wrapper] attach failed: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.reason === "session_closed") {
    log.info("session closed by host", { exitCode: result.exitCode });
    trackEvent("attach_ended", { reason: "session_closed", exitCode: result.exitCode ?? null });
    process.exit(result.exitCode ?? 0);
  }
  log.info("disconnected");
  trackEvent("attach_ended", { reason: result.reason });
  process.exit(0);
}

async function resolveTarget(opts: AttachOptions): Promise<TargetSession | null> {
  if (opts.id) {
    const found = findSession(opts.id);
    if (found) return { id: found.id, port: found.port, local: true };
    return { id: opts.id, local: false };
  }

  if (opts.port) {
    // Resolve the real session id from the registry so the attach can be
    // authorized. If the port isn't a known local session, keep it unknown —
    // authorization will then refuse (when a backend is configured).
    const byPort = findSessionByPort(opts.port);
    if (byPort) return { id: byPort.id, port: byPort.port, local: true };
    return { id: "<unknown>", port: opts.port, local: true };
  }

  const sessions = listSessions();
  if (sessions.length === 0) {
    process.stderr.write(
      "[wrapper] no live sessions. Open a new terminal or run `wrapper shell-host`.\n",
    );
    return null;
  }
  if (sessions.length === 1) {
    const only = sessions[0]!;
    return { id: only.id, port: only.port, local: true };
  }

  const picked = await pickSession(sessions);
  return picked;
}

interface TargetSession {
  id: string;
  port?: number;
  local: boolean;
}

async function pickSession(sessions: SessionRecord[]): Promise<TargetSession | null> {
  const sorted = sessions.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const choice = await p.select({
    message: "Multiple sessions are live. Pick one:",
    options: sorted.map((s) => ({
      value: s.id,
      label: `${s.id}  port=${s.port}  pid=${s.pid}`,
      hint: `${shortShell(s.shell)}  ${shortenHome(s.cwd)}`,
    })),
    initialValue: latestSession()?.id,
  });
  if (p.isCancel(choice)) return null;
  const found = sorted.find((s) => s.id === choice);
  if (!found) return null;
  return { id: found.id, port: found.port, local: true };
}

function shortShell(path: string): string {
  return path.split("/").pop() ?? path;
}

function shortenHome(path: string): string {
  const home = process.env.HOME;
  if (!home) return path;
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

async function ensureAttachAllowed(target: TargetSession): Promise<boolean> {
  if (!target.local || target.port === undefined) return false;

  const backend = await resolveAuthedConvexClient();
  // No backend configured: nothing to authorize against (pure local dev).
  if (backend.status === "unconfigured") return true;
  if (backend.status === "missing_auth") {
    process.stderr.write("[wrapper] backend auth required. Run `wrapper auth login` first.\n");
    return false;
  }
  if (backend.status === "auth_error") {
    process.stderr.write(`[wrapper] backend auth failed: ${backend.error.message}\n`);
    return false;
  }

  // A backend is configured but we couldn't resolve a session id (e.g. attach
  // by an unknown port). We cannot verify ownership/sharing, so refuse rather
  // than silently granting access.
  if (target.id === "<unknown>") {
    process.stderr.write(
      "[wrapper] cannot authorize attach by port alone. Re-run with `--id <sessionId>`.\n",
    );
    return false;
  }

  try {
    await backend.client.query(authorizeAttachRef, { sessionId: target.id });
    return true;
  } catch (error) {
    const message = normalizeAttachAuthorizationError(error);
    process.stderr.write(`[wrapper] attach authorization failed: ${message}\n`);
    return false;
  }
}

async function resolveAttachUrl(input: {
  host: string;
  target: TargetSession;
  preferRelay: boolean;
  code?: string;
}): Promise<string | null> {
  if (!input.preferRelay && input.target.local && input.target.port !== undefined) {
    const allowed = await ensureAttachAllowed(input.target);
    if (!allowed) return null;
    return `ws://${input.host}:${input.target.port}`;
  }

  if (input.target.id === "<unknown>") {
    process.stderr.write("[wrapper] relay attach requires `--id <sessionId>`.\n");
    return null;
  }
  return await resolveRelayAttachUrl(input.target.id, input.code);
}

async function resolveRelayAttachUrl(sessionId: string, code?: string): Promise<string | null> {
  const backend = await resolveAuthedConvexClient();
  if (backend.status === "unconfigured") {
    process.stderr.write("[wrapper] relay attach requires WRAPPER_CONVEX_URL configuration.\n");
    return null;
  }
  if (backend.status === "missing_auth") {
    process.stderr.write("[wrapper] relay attach requires login. Run `wrapper auth login`.\n");
    return null;
  }
  if (backend.status === "auth_error") {
    process.stderr.write(`[wrapper] relay attach failed: ${backend.error.message}\n`);
    return null;
  }

  try {
    const issued = await backend.client.mutation(issueViewerRelayTicketRef, { sessionId, code });
    return buildRelayWsUrl(env.relayUrl, issued.ticket);
  } catch (error) {
    const message = normalizeAttachAuthorizationError(error);
    process.stderr.write(`[wrapper] relay attach failed: ${message}\n`);
    return null;
  }
}

function normalizeAttachAuthorizationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = extractErrorCode(raw);

  switch (code) {
    case "UNAUTHORIZED":
      return "Not signed in. Run `wrapper auth login` and try again.";
    case "INSUFFICIENT_PERMISSION":
      return "Access denied. Ask the session owner for a share code and pass it with `--code <code>`, or attach to your own session.";
    case "RESOURCE_NOT_FOUND":
      return "Session not found or no longer active.";
    default:
      return raw;
  }
}

function extractErrorCode(message: string): string | null {
  const jsonCode = message.match(/"code":"([A-Z_]+)"/)?.[1];
  if (jsonCode) return jsonCode;

  const plainCode = message.match(
    /\b(UNAUTHORIZED|INSUFFICIENT_PERMISSION|RESOURCE_NOT_FOUND)\b/,
  )?.[1];
  return plainCode ?? null;
}

function buildRelayWsUrl(baseUrl: string, ticket: string): string {
  const url = new URL(baseUrl);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/ws";
  }
  url.searchParams.set("ticket", ticket);
  return url.toString();
}
