import { createLogger } from "@repo/logger";
import { encodeMessage, parseMessage, type SessionId, type WrapperMessage } from "@repo/protocol";
import { stripTerminalResponses } from "../shell/terminal-responses";
import { WebSocketTransport, type Transport, type TransportFactory } from "../transport/transport";
import { negotiateWebRtc, type Negotiation } from "../transport/webrtc";

const log = createLogger("attach-client");

// Local WS client used by both `wrapper attach` and host auto-attach.

export interface AttachClientOptions {
  url: string;
  /** Transport factory; defaults to a WebSocket to `url`. Lets WebRTC drop in. */
  transportFactory?: TransportFactory;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  initialSize?: { cols: number; rows: number };
  connectRetries?: number;
  connectRetryDelayMs?: number;
  interceptStdin?: (chunk: string) => string | null;
  /** Opt-in viewer P2P: negotiate a direct data channel for this session. */
  p2p?: { sessionId: SessionId };
}

export interface AttachResult {
  sessionId: SessionId | null;
  exitCode: number | null;
  reason: "session_closed" | "socket_closed" | "user_aborted" | "error";
  error?: Error;
}

export interface AttachClientHandle {
  done: Promise<AttachResult>;
  detach: () => Promise<AttachResult>;
  /** Send raw bytes to the session as input (used to forward stray keystrokes). */
  forwardInput: (data: string) => void;
}

const ABORTED_REASON = "user_aborted" as const;

export function startAttachClient(opts: AttachClientOptions): AttachClientHandle {
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;
  const maxAttempts = Math.max(1, opts.connectRetries ?? 1);
  const retryDelayMs = Math.max(0, opts.connectRetryDelayMs ?? 100);
  const makeTransport: TransportFactory =
    opts.transportFactory ?? ((handlers) => new WebSocketTransport(opts.url, handlers));

  let sessionId: SessionId | null = null;
  let exitCode: number | null = null;
  let reason: AttachResult["reason"] = "socket_closed";
  let lastError: Error | undefined;
  let resolveDone: (result: AttachResult) => void;

  const done = new Promise<AttachResult>((resolve) => {
    resolveDone = resolve;
  });

  let attempts = 1;
  let rawModeEnabled = false;
  let ioAttached = false;
  let finalized = false;
  // P2P fast path (opt-in). The relay WS stays as signaling + fallback; once the
  // data channel is open it carries session traffic and relay output is deduped.
  let dataTransport: Transport | null = null;
  let negotiation: Negotiation | null = null;

  // `stdin.isTTY` can be unreliable under bun run, so check setRawMode directly.
  const canRawMode = typeof stdin.setRawMode === "function";

  const enableRawMode = (): void => {
    if (rawModeEnabled || !canRawMode) return;
    try {
      stdin.setRawMode(true);
      rawModeEnabled = true;
    } catch (err) {
      log.warn("could not enable raw mode", { error: (err as Error).message });
    }
  };

  const disableRawMode = (): void => {
    if (!rawModeEnabled) return;
    try {
      stdin.setRawMode(false);
    } catch {
      // stdin may already be detached
    }
    rawModeEnabled = false;
  };

  const onStdin = (chunk: Buffer | string): void => {
    if (!sessionId) return;
    if (!transport.isOpen && !dataTransport?.isOpen) return;
    const raw = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    // Drop terminal query responses to avoid echo-looping them back into PTY.
    const cleaned = stripTerminalResponses(raw);
    if (cleaned.length === 0) return;
    // Optional prefix-interceptor hook (used by shell-host).
    const passthrough = opts.interceptStdin ? opts.interceptStdin(cleaned) : cleaned;
    if (passthrough === null || passthrough.length === 0) return;
    safeSend({ type: "input", sessionId, data: passthrough });
  };

  const onResize = (): void => {
    if (!sessionId) return;
    if (!transport.isOpen && !dataTransport?.isOpen) return;
    safeSend({
      type: "resize",
      sessionId,
      size: { cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 },
    });
  };

  const attachIO = (): void => {
    if (ioAttached) return;
    ioAttached = true;
    enableRawMode();
    stdin.on("data", onStdin);
    stdout.on("resize", onResize);
    if (canRawMode) stdin.resume();
  };

  const detachIO = (): void => {
    if (!ioAttached) return;
    ioAttached = false;
    stdin.off("data", onStdin);
    stdout.off("resize", onResize);
    if (canRawMode) stdin.pause();
    disableRawMode();
  };

  const finalize = (): AttachResult => {
    if (finalized) {
      return { sessionId, exitCode, reason, error: lastError };
    }
    finalized = true;
    detachIO();
    negotiation?.cancel();
    dataTransport?.close();
    transport.close();
    const result: AttachResult = { sessionId, exitCode, reason, error: lastError };
    resolveDone(result);
    return result;
  };

  function connect(): Transport {
    return makeTransport({
      onOpen: () => {
        log.debug("transport connected", { attempt: attempts });
        attachIO();
        if (opts.p2p && !negotiation) startP2P(opts.p2p.sessionId);
      },
      onMessage: (data) => {
        const msg = parseMessage(data as string | ArrayBuffer);
        if (!msg) {
          log.warn("dropping unparseable message from host");
          return;
        }
        if (msg.type === "signal") {
          negotiation?.acceptSignal(msg.kind, msg.data);
          return;
        }
        // Once P2P is live it carries output; drop the relay's duplicate copy.
        if (dataTransport?.isOpen && msg.type === "output") return;
        handleHostMessage(msg);
      },
      onClose: () => {
        // Retry during the initial connect window only.
        if (!ioAttached && attempts < maxAttempts && !finalized) {
          attempts += 1;
          log.debug("retrying connect", { attempt: attempts, maxAttempts });
          setTimeout(() => {
            if (finalized) return;
            transport = connect();
          }, retryDelayMs);
          return;
        }
        log.debug("transport closed");
        finalize();
      },
      onError: (info) => {
        if (!ioAttached && attempts < maxAttempts) {
          log.debug("connect attempt failed, will retry", {
            attempt: attempts,
            error: info.message,
          });
          return;
        }
        lastError = new Error(`transport error: ${info.message ?? "unknown"}`);
        reason = "error";
        log.error("transport error", { error: lastError.message });
        finalize();
      },
    });
  }

  let transport: Transport = connect();

  function handleHostMessage(msg: WrapperMessage): void {
    switch (msg.type) {
      case "session.opened":
        sessionId = msg.sessionId;
        log.debug("session attached", { sessionId, size: msg.size });
        if (opts.initialSize && sessionId) {
          safeSend({ type: "resize", sessionId, size: opts.initialSize });
        }
        break;
      case "output":
        stdout.write(msg.data);
        break;
      case "session.closed":
        exitCode = msg.exitCode;
        reason = "session_closed";
        log.debug("session ended remotely", { exitCode });
        // Complete the attach flow now rather than waiting for the socket to
        // close. Over the relay the viewer socket may linger after the host
        // session ends, which would otherwise keep the attach open forever.
        finalize();
        break;
      case "error":
        log.warn("host error", { code: msg.code, message: msg.message });
        break;
      default:
        break;
    }
  }

  function safeSend(msg: WrapperMessage): void {
    // Prefer the P2P channel when open; the relay WS is the fallback.
    const active = dataTransport?.isOpen ? dataTransport : transport;
    if (!active.isOpen) return;
    active.send(encodeMessage(msg));
  }

  function startP2P(p2pSessionId: SessionId): void {
    negotiation = negotiateWebRtc({
      role: "viewer",
      handlers: {
        onMessage: (data) => {
          const m = parseMessage(data as string | ArrayBuffer);
          if (m) handleHostMessage(m);
        },
        onClose: () => {
          dataTransport = null;
        },
        onError: () => {},
      },
      // Signaling always travels over the relay WS (never the data channel).
      sendSignal: ({ kind, data }) => {
        if (!transport.isOpen) return;
        transport.send(
          encodeMessage({
            type: "signal",
            sessionId: p2pSessionId,
            to: "host",
            from: "self",
            kind,
            data,
          }),
        );
      },
    });
    void (async () => {
      const t = await negotiation?.transport;
      if (t) {
        dataTransport = t;
        log.info("p2p data channel up (viewer)");
      }
    })();
  }

  return {
    done,
    detach: async (): Promise<AttachResult> => {
      if (!finalized) reason = ABORTED_REASON;
      return finalize();
    },
    forwardInput: (data: string): void => {
      if (!sessionId) return;
      safeSend({ type: "input", sessionId, data });
    },
  };
}

export async function runAttachClient(opts: AttachClientOptions): Promise<AttachResult> {
  return startAttachClient(opts).done;
}
