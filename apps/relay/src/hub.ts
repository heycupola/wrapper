import { encodeMessage, parseMessage, type WrapperMessage } from "./protocol";

export interface RelayPeer {
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
}

export type RelayRole = "host" | "viewer";

export interface PeerBinding {
  peer: RelayPeer;
  sessionId: string;
  role: RelayRole;
}

export interface RelayHubLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
}

const CLOSE_POLICY = 4003;
const CLOSE_HOST_REPLACED = 4009;
const CLOSE_HOST_DISCONNECTED = 4010;

interface ViewerState {
  size: { cols: number; rows: number } | null;
}

export class RelayHub {
  private readonly hostBySession = new Map<string, RelayPeer>();
  private readonly viewersBySession = new Map<string, Set<RelayPeer>>();
  private readonly bindingByPeer = new Map<RelayPeer, PeerBinding>();
  private readonly viewerState = new Map<RelayPeer, ViewerState>();
  // Last `session.opened` frame per session. The host emits it only once (on
  // connect), so viewers that join later must have it replayed — otherwise their
  // attach client never learns the sessionId and never forwards input.
  private readonly lastSessionOpened = new Map<string, string>();
  // Relay-assigned viewer identity for WebRTC signaling. Authoritative: clients
  // cannot spoof it (we stamp `from`), enabling safe host<->viewer routing.
  private readonly peerIdByViewer = new Map<RelayPeer, string>();
  private readonly viewerByPeerId = new Map<string, RelayPeer>();

  constructor(private readonly log: RelayHubLogger) {}

  bind(binding: PeerBinding): void {
    this.bindingByPeer.set(binding.peer, binding);

    if (binding.role === "host") {
      const existing = this.hostBySession.get(binding.sessionId);
      if (existing && existing !== binding.peer) {
        existing.close(CLOSE_HOST_REPLACED, "host replaced");
      }
      this.hostBySession.set(binding.sessionId, binding.peer);
      this.log.debug("host bound", { sessionId: binding.sessionId });
      return;
    }

    const viewers = this.viewersBySession.get(binding.sessionId) ?? new Set<RelayPeer>();
    viewers.add(binding.peer);
    this.viewersBySession.set(binding.sessionId, viewers);
    this.viewerState.set(binding.peer, { size: null });
    const peerId = crypto.randomUUID();
    this.peerIdByViewer.set(binding.peer, peerId);
    this.viewerByPeerId.set(peerId, binding.peer);
    // Replay the cached `session.opened` so this viewer learns the sessionId and
    // can start forwarding input immediately (the host won't re-emit it).
    const opened = this.lastSessionOpened.get(binding.sessionId);
    if (opened) binding.peer.send(opened);
    this.log.debug("viewer bound", {
      sessionId: binding.sessionId,
      viewerCount: viewers.size,
    });
  }

  unbind(peer: RelayPeer): void {
    const binding = this.bindingByPeer.get(peer);
    if (!binding) return;
    this.bindingByPeer.delete(peer);

    if (binding.role === "host") {
      this.hostBySession.delete(binding.sessionId);
      const viewers = this.viewersBySession.get(binding.sessionId);
      if (viewers && viewers.size > 0) {
        const closed = encodeMessage({
          type: "session.closed",
          sessionId: binding.sessionId,
          exitCode: null,
        });
        for (const viewer of viewers) {
          viewer.send(closed);
          viewer.close(CLOSE_HOST_DISCONNECTED, "host disconnected");
          this.bindingByPeer.delete(viewer);
          this.viewerState.delete(viewer);
          this.forgetViewerPeerId(viewer);
        }
      }
      this.viewersBySession.delete(binding.sessionId);
      this.lastSessionOpened.delete(binding.sessionId);
      this.log.debug("host unbound", { sessionId: binding.sessionId });
      return;
    }

    const viewers = this.viewersBySession.get(binding.sessionId);
    if (viewers) {
      viewers.delete(peer);
      if (viewers.size === 0) this.viewersBySession.delete(binding.sessionId);
    }
    this.viewerState.delete(peer);
    this.forgetViewerPeerId(peer);
    this.recomputeConsensusResize(binding.sessionId);
    this.log.debug("viewer unbound", {
      sessionId: binding.sessionId,
      viewerCount: viewers?.size ?? 0,
    });
  }

  routeInbound(peer: RelayPeer, payload: string | ArrayBuffer | Uint8Array): void {
    const binding = this.bindingByPeer.get(peer);
    if (!binding) {
      peer.close(CLOSE_POLICY, "unbound socket");
      return;
    }

    const msg = parseMessage(payload);
    if (!msg) {
      this.sendProtocolError(peer, binding.sessionId, "bad_message", "Invalid wrapper payload");
      return;
    }
    if (msg.sessionId !== binding.sessionId) {
      this.sendProtocolError(peer, binding.sessionId, "wrong_session", "Session mismatch");
      return;
    }

    if (binding.role === "host") {
      this.forwardHostMessage(binding, msg);
      return;
    }

    this.forwardViewerMessage(binding, msg, peer);
  }

  private forwardHostMessage(binding: PeerBinding, msg: WrapperMessage): void {
    switch (msg.type) {
      case "session.opened":
        // Cache so late-joining viewers can be caught up (see `bind`).
        this.lastSessionOpened.set(binding.sessionId, encodeMessage(msg));
        this.broadcastToViewers(binding.sessionId, msg);
        break;
      case "output":
      case "error":
        this.broadcastToViewers(binding.sessionId, msg);
        break;
      case "session.closed":
        // The session ended: deliver the final frame, then close every viewer
        // so relay attaches don't linger open after the host is gone.
        this.broadcastToViewers(binding.sessionId, msg);
        this.closeViewers(binding.sessionId, CLOSE_HOST_DISCONNECTED, "session closed");
        break;
      case "signal": {
        // WebRTC answer/ICE from host -> a specific viewer. Deliver only to a
        // viewer bound to THIS session (no cross-session / unknown-peer leaks).
        const viewer = this.viewerByPeerId.get(msg.to);
        if (!viewer || !this.viewersBySession.get(binding.sessionId)?.has(viewer)) return;
        viewer.send(encodeMessage(msg));
        break;
      }
      default:
        this.log.warn("unexpected host message", { type: msg.type, sessionId: binding.sessionId });
    }
  }

  private closeViewers(sessionId: string, code: number, reason: string): void {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers || viewers.size === 0) return;
    for (const viewer of viewers) {
      viewer.close(code, reason);
      this.bindingByPeer.delete(viewer);
      this.viewerState.delete(viewer);
      this.forgetViewerPeerId(viewer);
    }
    this.viewersBySession.delete(sessionId);
  }

  private forgetViewerPeerId(peer: RelayPeer): void {
    const peerId = this.peerIdByViewer.get(peer);
    if (peerId === undefined) return;
    this.peerIdByViewer.delete(peer);
    this.viewerByPeerId.delete(peerId);
  }

  private forwardViewerMessage(binding: PeerBinding, msg: WrapperMessage, peer: RelayPeer): void {
    const host = this.hostBySession.get(binding.sessionId);
    if (!host) {
      this.sendProtocolError(peer, binding.sessionId, "internal", "Host is offline");
      return;
    }

    switch (msg.type) {
      case "attach":
      case "detach":
      case "input":
        host.send(encodeMessage(msg));
        break;
      case "resize":
        this.viewerState.set(peer, { size: msg.size });
        this.recomputeConsensusResize(binding.sessionId);
        break;
      case "signal": {
        // WebRTC offer/ICE from viewer -> host. Stamp the authoritative peerId
        // (ignore any client-supplied `from`) so the host can address replies
        // back and a viewer cannot impersonate another peer.
        const peerId = this.peerIdByViewer.get(peer);
        if (!peerId) return;
        host.send(encodeMessage({ ...msg, from: peerId, to: "host" }));
        break;
      }
      default:
        this.log.warn("unexpected viewer message", {
          type: msg.type,
          sessionId: binding.sessionId,
        });
    }
  }

  private recomputeConsensusResize(sessionId: string): void {
    const host = this.hostBySession.get(sessionId);
    if (!host) return;
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers || viewers.size === 0) return;

    let cols: number | null = null;
    let rows: number | null = null;
    for (const viewer of viewers) {
      const state = this.viewerState.get(viewer);
      if (!state?.size) continue;
      cols = cols === null ? state.size.cols : Math.min(cols, state.size.cols);
      rows = rows === null ? state.size.rows : Math.min(rows, state.size.rows);
    }
    if (cols === null || rows === null) return;

    host.send(
      encodeMessage({
        type: "resize",
        sessionId,
        size: { cols, rows },
      }),
    );
  }

  private broadcastToViewers(sessionId: string, msg: WrapperMessage): void {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers || viewers.size === 0) return;

    const payload = encodeMessage(msg);
    for (const viewer of viewers) viewer.send(payload);
  }

  private sendProtocolError(
    peer: RelayPeer,
    sessionId: string,
    code: "bad_message" | "wrong_session" | "internal",
    message: string,
  ): void {
    peer.send(
      encodeMessage({
        type: "error",
        sessionId,
        code,
        message,
      }),
    );
  }
}
