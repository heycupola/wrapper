import { createLogger } from "@repo/logger";
import { encodeMessage, parseMessage, type SessionId, type WrapperMessage } from "@repo/protocol";
import type { PtySession } from "../pty/session";
import { WebSocketTransport, type Transport } from "../transport/transport";
import { negotiateWebRtc, type Negotiation } from "../transport/webrtc";

const log = createLogger("relay-host-bridge");

type SignalFrame = Extract<WrapperMessage, { type: "signal" }>;

export interface RelayHostBridgeOptions {
  relayUrl: string;
  ticket: string;
  sessionId: SessionId;
  pty: PtySession;
  /** Opt-in: negotiate direct P2P data channels with viewers (relay fallback). */
  enableP2P?: boolean;
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

  // Per-viewer WebRTC negotiations + open data channels (P2P fast path). Empty
  // unless enableP2P; output is fanned out to these in addition to the relay.
  const p2pPeers = new Map<string, { negotiation: Negotiation }>();
  const p2pChannels = new Map<string, Transport>();

  // The relay WebSocket is the transport and the WebRTC signaling channel. When
  // enableP2P is set, `handleSignal` negotiates per-viewer data channels and
  // `send` fans output to them; otherwise everything flows over this socket.
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
      if (msg.type === "signal") {
        if (opts.enableP2P) handleSignal(msg);
        return;
      }
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
    const frame = encodeMessage(msg);
    // Relay reaches WS viewers; P2P channels reach direct viewers. P2P viewers
    // ignore the relay copy (dedup on their side), so this fan-out is safe.
    if (transport.isOpen) transport.send(frame);
    for (const dt of p2pChannels.values()) {
      if (dt.isOpen) dt.send(frame);
    }
  }

  // Negotiate/route a viewer's WebRTC signaling. `msg.from` is the relay's
  // authoritative peerId for that viewer, so replies are addressed back to it.
  function handleSignal(msg: SignalFrame): void {
    const peerId = msg.from;
    if (msg.kind === "bye") {
      p2pPeers.get(peerId)?.negotiation.cancel();
      p2pPeers.delete(peerId);
      p2pChannels.delete(peerId);
      return;
    }
    let entry = p2pPeers.get(peerId);
    if (!entry) {
      const negotiation = negotiateWebRtc({
        role: "host",
        handlers: {
          onMessage: (data) => {
            const m = parseMessage(data as string | ArrayBuffer);
            if (
              m &&
              m.sessionId === opts.sessionId &&
              (m.type === "input" || m.type === "resize")
            ) {
              handleInbound(m);
            }
          },
          onClose: () => {
            p2pChannels.delete(peerId);
          },
          onError: () => {
            p2pChannels.delete(peerId);
          },
        },
        sendSignal: ({ kind, data }) => {
          if (!transport.isOpen) return;
          transport.send(
            encodeMessage({
              type: "signal",
              sessionId: opts.sessionId,
              to: peerId,
              from: "host",
              kind,
              data,
            }),
          );
        },
      });
      entry = { negotiation };
      p2pPeers.set(peerId, entry);
      void (async () => {
        const t = await negotiation.transport;
        if (t) {
          p2pChannels.set(peerId, t);
          log.info("p2p data channel up (host)", { sessionId: opts.sessionId, peerId });
        }
      })();
    }
    entry.negotiation.acceptSignal(msg.kind, msg.data);
  }

  function close(): void {
    if (closed) return;
    closed = true;
    opts.pty.off("data", onPtyData);
    opts.pty.off("exit", onPtyExit);
    for (const entry of p2pPeers.values()) entry.negotiation.cancel();
    p2pPeers.clear();
    p2pChannels.clear();
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
