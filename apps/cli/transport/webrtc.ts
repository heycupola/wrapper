// werift's RTCDataChannel delivers events via `on*` callbacks (not
// addEventListener), so the on-assignment style is intentional here.
/* eslint-disable unicorn/prefer-add-event-listener */
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
const DISCONNECTED_GRACE_MS = 3000;
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
  let stopped = false;
  let channelTransport: DataChannelTransport | null = null;
  let connectionState = "new";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
  let remoteDescriptionReady = false;
  const pendingIce: unknown[] = [];
  let resolveTransport!: (t: Transport | null) => void;
  const transport = new Promise<Transport | null>((resolve) => {
    resolveTransport = resolve;
  });

  const clearTimers = (): void => {
    if (timer) clearTimeout(timer);
    if (disconnectedTimer) clearTimeout(disconnectedTimer);
    timer = null;
    disconnectedTimer = null;
  };

  const finish = (t: Transport | null): void => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    timer = null;
    resolveTransport(t);
  };

  const flushPendingIce = async (): Promise<void> => {
    const candidates = pendingIce.splice(0);
    await Promise.all(candidates.map((candidate) => pc.addIceCandidate(candidate as never)));
  };

  const stopPeer = (): void => {
    if (stopped) return;
    stopped = true;
    clearTimers();
    channelTransport?.markOpen(false);
    finish(null);
    void pc.close();
  };

  const failPeer = (message: string): void => {
    if (stopped) return;
    const wasOpen = channelTransport?.isOpen ?? false;
    stopped = true;
    clearTimers();
    channelTransport?.markOpen(false);
    finish(null);
    // Before opening, resolving null is enough: callers stay on the relay. Once
    // open, notify them immediately so input switches back to the relay instead
    // of being sent into a dead data channel.
    if (wasOpen) opts.handlers.onError?.({ message });
    else log.debug("webrtc negotiation failed; using relay fallback", { role: opts.role, message });
    void pc.close();
  };

  timer = setTimeout(() => {
    if (settled || stopped) return;
    log.debug("webrtc negotiation timed out; falling back to relay", { role: opts.role });
    stopPeer();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  timer.unref?.();

  const closePeer = (): void => {
    stopPeer();
  };

  const wireChannel = (channel: {
    readyState: string;
    send: (d: string) => void;
    onopen?: (() => void) | undefined;
    onclose?: (() => void) | undefined;
    onmessage?: ((ev: { data: unknown }) => void) | undefined;
  }): void => {
    const dt = new DataChannelTransport(channel, closePeer, channel.readyState === "open");
    channelTransport = dt;
    channel.onopen = () => {
      if (stopped) return;
      dt.markOpen(true);
      if (timer) clearTimeout(timer);
      timer = null;
      opts.handlers.onOpen?.();
      finish(dt);
    };
    channel.onclose = () => {
      dt.markOpen(false);
      if (stopped) return;
      stopped = true;
      clearTimers();
      opts.handlers.onClose?.({});
      finish(null);
      void pc.close();
    };
    channel.onmessage = (ev) => {
      if (stopped) return;
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
    connectionState = state;
    if (state === "connected") {
      if (disconnectedTimer) clearTimeout(disconnectedTimer);
      disconnectedTimer = null;
      return;
    }
    if (state === "disconnected") {
      if (disconnectedTimer) return;
      disconnectedTimer = setTimeout(() => {
        disconnectedTimer = null;
        if (connectionState !== "connected") {
          failPeer("peer connection disconnected");
        }
      }, DISCONNECTED_GRACE_MS);
      disconnectedTimer.unref?.();
      return;
    }
    if (state === "failed") {
      failPeer("peer connection failed");
    } else if (state === "closed" && !stopped) {
      failPeer("peer connection closed");
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
        failPeer("failed to create WebRTC offer");
      }
    })();
  } else {
    pc.onDataChannel.subscribe((channel) => {
      wireChannel(channel as never);
    });
  }

  const acceptSignal = (kind: SignalKind, data: string): void => {
    if (stopped) return;
    void (async () => {
      try {
        if (kind === "offer") {
          await pc.setRemoteDescription(JSON.parse(data));
          remoteDescriptionReady = true;
          await flushPendingIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          opts.sendSignal({ kind: "answer", data: JSON.stringify(pc.localDescription) });
        } else if (kind === "answer") {
          await pc.setRemoteDescription(JSON.parse(data));
          remoteDescriptionReady = true;
          await flushPendingIce();
        } else if (kind === "ice") {
          const candidate: unknown = JSON.parse(data);
          if (remoteDescriptionReady) {
            await pc.addIceCandidate(candidate as never);
          } else {
            // ICE callbacks may fire before the offer/answer frame is sent. Queue
            // candidates until the remote description exists instead of dropping
            // them with an InvalidStateError.
            pendingIce.push(candidate);
          }
        } else if (kind === "bye") {
          stopPeer();
        }
      } catch (err) {
        log.warn("failed to apply webrtc signal", { kind, error: (err as Error).message });
        if (kind !== "ice") failPeer(`failed to apply WebRTC ${kind}`);
      }
    })();
  };

  return {
    transport,
    acceptSignal,
    cancel: stopPeer,
  };
}
