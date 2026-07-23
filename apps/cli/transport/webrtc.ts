import { createLogger } from "@repo/logger";
import type { SignalMessage } from "@repo/protocol";
import { RTCPeerConnection } from "werift";
import type { Transport, TransportHandlers } from "./transport";

const log = createLogger("webrtc");

// Public STUN for candidate discovery. The relay is the TURN-equivalent fallback:
// if P2P can't be established, callers keep using the WebSocket relay transport.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];
const DEFAULT_TIMEOUT_MS = 8000;
const DATA_CHANNEL_LABEL = "wrapper";

export type SignalKind = SignalMessage["kind"];
export interface OutboundSignal {
  kind: SignalKind;
  data: string;
}

export interface NegotiateOptions {
  /** "viewer" creates the offer + data channel; "host" answers. */
  role: "host" | "viewer";
  /** Handlers for the resulting data-channel transport. */
  handlers: TransportHandlers;
  /** Emit a signaling frame to the peer (carried over the relay). */
  sendSignal: (out: OutboundSignal) => void;
  timeoutMs?: number;
}

export interface Negotiation {
  /** Resolves with the data-channel transport once open, or null on timeout/failure. */
  readonly transport: Promise<Transport | null>;
  /** Feed an inbound signaling frame from the peer. */
  acceptSignal: (kind: SignalKind, data: string) => void;
  /** Abort negotiation and tear down the peer connection. */
  cancel: () => void;
}

/** A `Transport` backed by a werift RTCDataChannel. */
class DataChannelTransport implements Transport {
  readonly describe = "webrtc";
  private open: boolean;

  constructor(
    private readonly channel: { readyState: string; send: (d: string) => void; onclose?: unknown },
    private readonly closePeer: () => void,
    initiallyOpen: boolean,
  ) {
    this.open = initiallyOpen;
  }

  markOpen(v: boolean): void {
    this.open = v;
  }

  get isOpen(): boolean {
    return this.open;
  }

  send(frame: string): void {
    if (!this.open) return;
    try {
      this.channel.send(frame);
    } catch {
      // close handler reports the disconnect
    }
  }

  close(): void {
    this.open = false;
    this.closePeer();
  }
}

/**
 * Negotiate a direct WebRTC data channel with the peer, exchanging SDP/ICE via
 * the caller-provided `sendSignal`/`acceptSignal` (which the caller pipes over
 * the relay). Never throws; resolves `null` if the channel isn't open in time so
 * the caller can fall back to the relay.
 */
export function negotiateWebRtc(opts: NegotiateOptions): Negotiation {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let settled = false;
  let resolveTransport!: (t: Transport | null) => void;
  const transport = new Promise<Transport | null>((resolve) => {
    resolveTransport = resolve;
  });

  const finish = (t: Transport | null): void => {
    if (settled) return;
    settled = true;
    resolveTransport(t);
  };

  const timer = setTimeout(() => {
    if (!settled) {
      log.debug("webrtc negotiation timed out; falling back to relay", { role: opts.role });
      finish(null);
      void pc.close();
    }
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  timer.unref?.();

  const closePeer = (): void => {
    clearTimeout(timer);
    void pc.close();
  };

  const wireChannel = (channel: {
    readyState: string;
    send: (d: string) => void;
    onopen?: (() => void) | undefined;
    onclose?: (() => void) | undefined;
    onmessage?: ((ev: { data: unknown }) => void) | undefined;
  }): void => {
    const dt = new DataChannelTransport(channel, closePeer, channel.readyState === "open");
    channel.onopen = () => {
      dt.markOpen(true);
      clearTimeout(timer);
      opts.handlers.onOpen?.();
      finish(dt);
    };
    channel.onclose = () => {
      dt.markOpen(false);
      opts.handlers.onClose?.({});
      finish(null);
    };
    channel.onmessage = (ev) => {
      const d = ev.data;
      if (typeof d === "string") {
        opts.handlers.onMessage?.(d);
        return;
      }
      if (d instanceof ArrayBuffer) {
        opts.handlers.onMessage?.(d);
        return;
      }
      // Buffer / Uint8Array (werift): decode to text — our frames are JSON.
      opts.handlers.onMessage?.(new TextDecoder().decode(d as Uint8Array));
    };
    if (channel.readyState === "open") channel.onopen?.();
  };

  pc.onIceCandidate.subscribe((candidate) => {
    if (!candidate) return;
    opts.sendSignal({ kind: "ice", data: JSON.stringify(candidate) });
  });

  pc.connectionStateChange.subscribe((state) => {
    if (state === "failed" || state === "closed") {
      opts.handlers.onError?.({ message: `peer connection ${state}` });
      finish(null);
    }
  });

  if (opts.role === "viewer") {
    const channel = pc.createDataChannel(DATA_CHANNEL_LABEL);
    wireChannel(channel as never);
    void (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        opts.sendSignal({ kind: "offer", data: JSON.stringify(pc.localDescription) });
      } catch (err) {
        log.warn("failed to create webrtc offer", { error: (err as Error).message });
        finish(null);
        void pc.close();
      }
    })();
  } else {
    pc.onDataChannel.subscribe((channel) => {
      wireChannel(channel as never);
    });
  }

  const acceptSignal = (kind: SignalKind, data: string): void => {
    void (async () => {
      try {
        if (kind === "offer") {
          await pc.setRemoteDescription(JSON.parse(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          opts.sendSignal({ kind: "answer", data: JSON.stringify(pc.localDescription) });
        } else if (kind === "answer") {
          await pc.setRemoteDescription(JSON.parse(data));
        } else if (kind === "ice") {
          await pc.addIceCandidate(JSON.parse(data));
        } else if (kind === "bye") {
          finish(null);
          void pc.close();
        }
      } catch (err) {
        log.warn("failed to apply webrtc signal", { kind, error: (err as Error).message });
      }
    })();
  };

  return {
    transport,
    acceptSignal,
    cancel: () => {
      finish(null);
      closePeer();
    },
  };
}
