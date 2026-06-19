import type { Server, ServerWebSocket } from "bun";
import { createLogger } from "@repo/logger";
import { encodeMessage, parseMessage, type SessionId, type WrapperMessage } from "@repo/protocol";
import type { PtySession } from "../pty/session";

const log = createLogger("server");

// Local WS fan-out for one PTY session.

interface ClientData {
  sessionId: SessionId;
  size: { cols: number; rows: number } | null;
}

type WsClient = ServerWebSocket<ClientData>;

export interface LocalServerOptions {
  port: number;
  hostname?: string;
  sessionId: SessionId;
  pty: PtySession;
}

export interface LocalServerHandle {
  readonly port: number;
  clientCount(): number;
  stop(): Promise<void>;
}

const CLOSE_NORMAL = 1000;
const CLOSE_SESSION_GONE = 4001;

export function startLocalServer(opts: LocalServerOptions): LocalServerHandle {
  const clients = new Set<WsClient>();
  let stopped = false;

  const server: Server<ClientData> = Bun.serve<ClientData>({
    port: opts.port,
    hostname: opts.hostname ?? "127.0.0.1",
    fetch(req, srv) {
      const ok = srv.upgrade(req, { data: { sessionId: opts.sessionId, size: null } });
      if (ok) return undefined;
      return new Response("Expected WebSocket upgrade", { status: 426 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        log.debug("ws client connected", { clientCount: clients.size });
        send(ws, {
          type: "session.opened",
          sessionId: opts.sessionId,
          size: opts.pty.size,
        });
        // Replay tail for late joiners, then request redraw.
        const replay = opts.pty.replayBuffer;
        if (replay.length > 0) {
          send(ws, {
            type: "output",
            sessionId: opts.sessionId,
            data: replay,
          });
        }
        opts.pty.requestRedraw();
      },
      message(ws, raw) {
        const msg = parseMessage(raw);
        if (!msg) {
          send(ws, {
            type: "error",
            sessionId: opts.sessionId,
            code: "bad_message",
            message: "payload is not a valid wrapper message",
          });
          return;
        }
        if (msg.sessionId !== opts.sessionId) {
          send(ws, {
            type: "error",
            sessionId: opts.sessionId,
            code: "wrong_session",
            message: `expected sessionId ${opts.sessionId}`,
          });
          return;
        }
        handleClientMessage(ws, msg);
      },
      close(ws) {
        clients.delete(ws);
        log.debug("ws client disconnected", { clientCount: clients.size });
        applyConsensusSize();
      },
    },
  });

  const onData = (chunk: string): void => {
    if (clients.size === 0) return;
    broadcast({ type: "output", sessionId: opts.sessionId, data: chunk });
  };

  const onExit = (exitCode: number | null): void => {
    broadcast({ type: "session.closed", sessionId: opts.sessionId, exitCode });
    for (const ws of clients) {
      try {
        ws.close(CLOSE_SESSION_GONE, "session ended");
      } catch {
        // socket already gone
      }
    }
    clients.clear();
  };

  opts.pty.on("data", onData);
  opts.pty.on("exit", onExit);

  function handleClientMessage(ws: WsClient, msg: WrapperMessage): void {
    switch (msg.type) {
      case "input":
        opts.pty.write(msg.data);
        break;
      case "resize":
        ws.data.size = msg.size;
        applyConsensusSize();
        break;
      case "attach":
      case "detach":
        // Reserved for explicit attach semantics later.
        break;
      default:
        break;
    }
  }

  // Use smallest requested cols/rows so every attached client can render.
  function applyConsensusSize(): void {
    let cols: number | null = null;
    let rows: number | null = null;
    for (const ws of clients) {
      const s = ws.data.size;
      if (!s) continue;
      cols = cols === null ? s.cols : Math.min(cols, s.cols);
      rows = rows === null ? s.rows : Math.min(rows, s.rows);
    }
    if (cols === null || rows === null) return;
    opts.pty.resize({ cols, rows });
  }

  function send(ws: WsClient, msg: WrapperMessage): void {
    try {
      ws.send(encodeMessage(msg));
    } catch (err) {
      log.warn("ws send failed", { error: (err as Error).message });
    }
  }

  function broadcast(msg: WrapperMessage): void {
    const payload = encodeMessage(msg);
    for (const ws of clients) {
      try {
        ws.send(payload);
      } catch (err) {
        log.warn("ws broadcast failed", { error: (err as Error).message });
      }
    }
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    opts.pty.off("data", onData);
    opts.pty.off("exit", onExit);
    for (const ws of clients) {
      try {
        ws.close(CLOSE_NORMAL, "server shutting down");
      } catch {
        // ignore
      }
    }
    clients.clear();
    // Work around Bun stop hang on recent socket disconnects.
    await Promise.race([server.stop(true), wait(250)]);
  }

  return {
    get port(): number {
      return server.port ?? opts.port;
    },
    clientCount: () => clients.size,
    stop,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
