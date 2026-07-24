/**
 * Transport abstraction for the wrapper wire protocol.
 *
 * Host and viewer speak the same `@repo/protocol` frames; only the underlying
 * channel differs. Today that channel is a WebSocket to the relay; next it will
 * be a WebRTC data channel for direct P2P (with the relay kept as fallback).
 * Keeping the pipe dumb (opaque string/binary frames in, callbacks out) lets the
 * host/viewer code stay transport-agnostic.
 */

export type TransportCloseInfo = { code?: number; reason?: string };
export type TransportErrorInfo = { message?: string };

export interface TransportHandlers {
  onOpen?: () => void;
  onMessage?: (data: string | ArrayBuffer) => void;
  onClose?: (info: TransportCloseInfo) => void;
  onError?: (info: TransportErrorInfo) => void;
}

export interface Transport {
  /** Send an already-encoded protocol frame. No-op if not open. */
  send(frame: string): void;
  /** True once the channel is open for sending. */
  readonly isOpen: boolean;
  /** A short label for logs (e.g. the sanitized URL or "webrtc"). */
  readonly describe: string;
  close(): void;
}

/** A `Transport` backed by a browser/Bun `WebSocket`. */
export class WebSocketTransport implements Transport {
  private readonly ws: WebSocket;
  readonly describe: string;

  constructor(url: string, handlers: TransportHandlers) {
    this.describe = url.replace(/ticket=[^&]+/, "ticket=***").replace(/token=[^&]+/, "token=***");
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("open", () => handlers.onOpen?.());
    this.ws.addEventListener("message", (ev) =>
      handlers.onMessage?.(ev.data as string | ArrayBuffer),
    );
    this.ws.addEventListener("close", (ev) => {
      const { code, reason } = ev as { code?: number; reason?: string };
      handlers.onClose?.({ code, reason: reason && reason.length > 0 ? reason : undefined });
    });
    this.ws.addEventListener("error", (ev) => {
      const message = (ev as { message?: string }).message;
      handlers.onError?.({ message: message && message.length > 0 ? message : undefined });
    });
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  send(frame: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(frame);
    } catch {
      // The close handler reports the disconnect.
    }
  }

  close(): void {
    try {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    } catch {
      // already closed
    }
  }
}

/** Factory type so callers can be handed a transport constructor (WS or WebRTC). */
export type TransportFactory = (handlers: TransportHandlers) => Transport;
