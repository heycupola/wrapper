import { createLogger } from "@repo/logger";
import { encodeMessage, parseMessage, type SessionId, type WrapperMessage } from "@repo/protocol";
import type { PtySession } from "../pty/session";
import { WebSocketTransport, type Transport } from "../transport/transport";

const log = createLogger("relay-host-bridge");

export interface RelayHostBridgeOptions {
  relayUrl: string;
  ticket: string;
  sessionId: SessionId;
  pty: PtySession;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export interface RelayHostBridge {
  stop: () => Promise<void>;
}

export function startRelayHostBridge(opts: RelayHostBridgeOptions): RelayHostBridge {
  const wsUrl = buildRelayWsUrl(opts.relayUrl, opts.ticket);
  const safeUrl = wsUrl.replace(/ticket=[^&]+/, "ticket=***");
  let closed = false;

  // Transport is a dumb protocol-frame pipe. Today it's a WebSocket to the
  // relay; a WebRtcTransport will drop in here for direct P2P (relay fallback).
  const transport: Transport = new WebSocketTransport(wsUrl, {
    onOpen: () => {
      log.info("relay host connected", { sessionId: opts.sessionId });
      opts.onOpen?.();
      send({
        type: "session.opened",
        sessionId: opts.sessionId,
        size: opts.pty.size,
      });
    },
    onMessage: (data) => {
      const msg = parseMessage(data as string | ArrayBuffer);
      if (!msg) return;
      if (msg.sessionId !== opts.sessionId) return;
      handleInbound(msg);
    },
    onClose: (info) => {
      opts.onClose?.();
      if (!closed) {
        log.warn("relay host disconnected", {
          sessionId: opts.sessionId,
          code: info.code,
          reason: info.reason,
        });
      }
    },
    onError: (info) => {
      opts.onError?.(new Error("relay websocket error"));
      log.warn("relay host websocket error", {
        sessionId: opts.sessionId,
        url: safeUrl,
        message: info.message,
      });
    },
  });

  const onPtyData = (chunk: string): void => {
    send({
      type: "output",
      sessionId: opts.sessionId,
      data: chunk,
    });
  };

  const onPtyExit = (exitCode: number | null): void => {
    send({
      type: "session.closed",
      sessionId: opts.sessionId,
      exitCode,
    });
    close();
  };

  opts.pty.on("data", onPtyData);
  opts.pty.on("exit", onPtyExit);

  function handleInbound(msg: WrapperMessage): void {
    switch (msg.type) {
      case "input":
        opts.pty.write(msg.data);
        break;
      case "resize":
        opts.pty.resize(msg.size);
        break;
      case "attach":
      case "detach":
      case "error":
      case "output":
      case "session.opened":
      case "session.closed":
        break;
      default:
        break;
    }
  }

  function send(msg: WrapperMessage): void {
    if (!transport.isOpen) return;
    transport.send(encodeMessage(msg));
  }

  function close(): void {
    if (closed) return;
    closed = true;
    opts.pty.off("data", onPtyData);
    opts.pty.off("exit", onPtyExit);
    transport.close();
  }

  return {
    stop: async () => {
      close();
    },
  };
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
