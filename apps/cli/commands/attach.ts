import * as p from "@clack/prompts";
import { createLogger, trackError, trackEvent } from "@repo/logger";
import { makeFunctionReference } from "convex/server";
import pc from "picocolors";
import { startAttachClient, type AttachTransportStatus } from "../client/attach-client";
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
import { resolvePrefix } from "../util/prefix-config";
import {
  bell,
  clearTitle,
  formatControlsHint,
  formatSessionHud,
  inlineMessage,
  setTitle,
  type SessionTransportStatus,
} from "../util/feedback";
import { installShutdownHandlers } from "../util/signals";
import { command, fail, tag, warn } from "../util/ui";

const log = createLogger("attach");

type IssueViewerTicketArgs = {
  sessionId: string;
  code?: string;
};

type IssueViewerTicketResponse = {
  ticket: string;
  expiresAt: number;
  canInput?: boolean;
  isOwner?: boolean;
};

const issueViewerRelayTicketRef = makeFunctionReference<
  "action",
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
  const urlResult = await resolveAttachUrl({
    host,
    target,
    preferRelay: Boolean(opts.relay),
    code: opts.code,
  });
  if (!urlResult) process.exit(1);
  const { url, canInput: ticketCanInput } = urlResult;
  // Relay URLs carry a single-use join ticket, and local URLs carry the loopback
  // token, in the query string. Redact both so no credential lands in the log
  // file or the terminal scrollback.
  const prefix = resolvePrefix();
  const safeUrl = url.replace(/ticket=[^&]+/, "ticket=***").replace(/token=[^&]+/, "token=***");
  log.info("attaching", { url: safeUrl, sessionId: target.id });
  trackEvent("attach_started");
  const sessionTag = target.id.slice(0, 6);
  const usingRelay = url.includes("/ws?ticket=");
  process.stderr.write(
    `${tag()} attaching to ${pc.cyan(sessionTag)} via ${usingRelay ? "relay" : "local"} ${pc.dim(safeUrl)}\n`,
  );
  process.stderr.write(
    `${tag()} ${pc.dim(`${formatControlsHint("viewer", prefix.label)} · session keeps running`)}\n`,
  );

  let userAborted = false;
  let transportStatus: AttachTransportStatus = "connecting";

  const hudTransport = (): SessionTransportStatus => {
    if (transportStatus === "closed") return "offline";
    return transportStatus;
  };

  let viewerCanInput = ticketCanInput;
  const paintViewerTitle = (armed = false): void => {
    if (!env.hudEnabled) return;
    setTitle(
      formatSessionHud({
        role: "viewer",
        sessionTag,
        transport: hudTransport(),
        armed,
        guestAccess: usingRelay ? (viewerCanInput ? "rw" : "view") : undefined,
      }),
    );
  };

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
        inlineMessage(
          `viewing ${sessionTag} transport=${hudTransport()}${
            target.port === undefined ? "" : ` port=${target.port}`
          }`,
        );
        paintViewerTitle();
        break;
      case "share":
      case "unshare":
      case "typing":
        // Viewer cannot publish a session it doesn't own. Bell-only
        // hint so the user knows the keystroke landed somewhere.
        inlineMessage("only the session host can share/unshare");
        bell();
        break;
    }
  };

  const prefixFilter = new PrefixFilter({
    prefix: prefix.byte,
    onCommand: handlePrefixCommand,
    onForward: (data) => handle.forwardInput(data),
    onArmedChange: (armed) => {
      if (armed) {
        paintViewerTitle(true);
        bell();
      } else {
        paintViewerTitle();
      }
    },
  });

  // P2P applies only to relay attaches (remote peers); local 127.0.0.1 attaches
  // are already direct. Relay URLs carry the `/ws?ticket=` path.
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
    canInput: ticketCanInput,
    onCanInputChange: (next) => {
      viewerCanInput = next;
      paintViewerTitle();
    },
    onTransportChange: (status) => {
      transportStatus = status;
      paintViewerTitle();
    },
    onTerminalTitle: paintViewerTitle,
  });

  // Initial title so the user sees this is a viewer window.
  paintViewerTitle();

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
    process.stderr.write(`${fail(`attach failed: ${result.error.message}`)}\n`);
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
    if (found) return { id: found.id, port: found.port, local: true, localToken: found.localToken };
    return { id: opts.id, local: false };
  }

  if (opts.port) {
    // Resolve the real session id from the registry so the attach can be
    // authorized. If the port isn't a known local session, keep it unknown —
    // authorization will then refuse (when a backend is configured).
    const byPort = findSessionByPort(opts.port);
    if (byPort) {
      return { id: byPort.id, port: byPort.port, local: true, localToken: byPort.localToken };
    }
    return { id: "<unknown>", port: opts.port, local: true };
  }

  const sessions = listSessions();
  if (sessions.length === 0) {
    process.stderr.write(
      `${warn("no live sessions.")} Start one with ${command("wrapper share")} or ${command("wrapper run -- <cmd>")}\n`,
    );
    return null;
  }
  if (sessions.length === 1) {
    const only = sessions[0]!;
    return { id: only.id, port: only.port, local: true, localToken: only.localToken };
  }

  const picked = await pickSession(sessions);
  return picked;
}

interface TargetSession {
  id: string;
  port?: number;
  local: boolean;
  localToken?: string;
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
  return { id: found.id, port: found.port, local: true, localToken: found.localToken };
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

  // Local attach is gated by the loopback token in sessions.json. Convex is
  // not contacted until a session is shared, so unshared hosts have no row.
  if (target.id === "<unknown>" && !target.localToken) {
    process.stderr.write(
      `${fail("cannot attach by port alone without a local token.")} Re-run with ${command("--id <sessionId>")}\n`,
    );
    return false;
  }

  return true;
}

async function resolveAttachUrl(input: {
  host: string;
  target: TargetSession;
  preferRelay: boolean;
  code?: string;
}): Promise<{ url: string; canInput: boolean } | null> {
  if (!input.preferRelay && input.target.local && input.target.port !== undefined) {
    const allowed = await ensureAttachAllowed(input.target);
    if (!allowed) return null;
    const base = `ws://${input.host}:${input.target.port}`;
    const url = input.target.localToken ? `${base}?token=${input.target.localToken}` : base;
    return { url, canInput: true };
  }

  if (input.target.id === "<unknown>") {
    process.stderr.write(`${fail("relay attach requires")} ${command("--id <sessionId>")}\n`);
    return null;
  }
  return await resolveRelayAttachUrl(input.target.id, input.code);
}

async function resolveRelayAttachUrl(
  sessionId: string,
  code?: string,
): Promise<{ url: string; canInput: boolean } | null> {
  const backend = await resolveAuthedConvexClient();
  if (backend.status === "unconfigured") {
    process.stderr.write(`${fail("relay attach requires WRAPPER_CONVEX_URL configuration.")}\n`);
    return null;
  }
  if (backend.status === "missing_auth") {
    process.stderr.write(
      `${fail("relay attach requires login.")} Run ${command("wrapper auth login")}\n`,
    );
    return null;
  }
  if (backend.status === "auth_error") {
    process.stderr.write(`${fail(`relay attach failed: ${backend.error.message}`)}\n`);
    return null;
  }

  let shareCode = code?.trim();
  try {
    const issued = await backend.client.action(issueViewerRelayTicketRef, {
      sessionId,
      code: shareCode,
    });
    return {
      url: buildRelayWsUrl(env.relayUrl, issued.ticket),
      canInput: issued.canInput !== false,
    };
  } catch (initialError) {
    let failure: unknown = initialError;
    const errorCode = extractErrorCode(
      initialError instanceof Error ? initialError.message : String(initialError),
    );
    if (!shareCode && errorCode === "INSUFFICIENT_PERMISSION" && process.stdin.isTTY) {
      const prompted = await p.password({
        message: "Share code (ask the session owner):",
        validate(value) {
          return !value || value.trim().length === 0 ? "Share code is required" : undefined;
        },
      });
      if (p.isCancel(prompted)) {
        process.stderr.write(`${warn("relay attach cancelled.")}\n`);
        return null;
      }
      shareCode = String(prompted).trim();
      try {
        const issued = await backend.client.action(issueViewerRelayTicketRef, {
          sessionId,
          code: shareCode,
        });
        return {
          url: buildRelayWsUrl(env.relayUrl, issued.ticket),
          canInput: issued.canInput !== false,
        };
      } catch (retryError) {
        failure = retryError;
      }
    }

    const message = normalizeAttachAuthorizationError(failure);
    process.stderr.write(`${fail(`relay attach failed: ${message}`)}\n`);
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
      return "Access denied. Check the session id and share code with the owner.";
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
