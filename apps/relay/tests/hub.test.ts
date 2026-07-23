import { describe, expect, test } from "bun:test";
import { RelayHub, type RelayPeer } from "../src/hub";

class FakePeer implements RelayPeer {
  public readonly sent: string[] = [];
  public closedWith: { code?: number; reason?: string } | null = null;

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
  }
}

const noopLog = {
  debug: () => {},
  warn: () => {},
};

describe("RelayHub routing", () => {
  test("forwards viewer input to host", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewer = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewer, role: "viewer", sessionId: "s1" });

    hub.routeInbound(
      viewer,
      JSON.stringify({
        type: "input",
        sessionId: "s1",
        data: "ls\n",
      }),
    );

    expect(host.sent).toHaveLength(1);
    expect(host.sent[0]).toContain('"type":"input"');
  });

  test("forwards host output to all viewers", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewerA = new FakePeer();
    const viewerB = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewerA, role: "viewer", sessionId: "s1" });
    hub.bind({ peer: viewerB, role: "viewer", sessionId: "s1" });

    hub.routeInbound(
      host,
      JSON.stringify({
        type: "output",
        sessionId: "s1",
        data: "hello\n",
      }),
    );

    expect(viewerA.sent).toHaveLength(1);
    expect(viewerB.sent).toHaveLength(1);
    expect(viewerA.sent[0]).toContain('"type":"output"');
  });

  test("viewer resize uses smallest consensus", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewerA = new FakePeer();
    const viewerB = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewerA, role: "viewer", sessionId: "s1" });
    hub.bind({ peer: viewerB, role: "viewer", sessionId: "s1" });

    hub.routeInbound(
      viewerA,
      JSON.stringify({
        type: "resize",
        sessionId: "s1",
        size: { cols: 140, rows: 50 },
      }),
    );
    hub.routeInbound(
      viewerB,
      JSON.stringify({
        type: "resize",
        sessionId: "s1",
        size: { cols: 100, rows: 40 },
      }),
    );

    expect(host.sent.at(-1)).toContain('"type":"resize"');
    expect(host.sent.at(-1)).toContain('"cols":100');
    expect(host.sent.at(-1)).toContain('"rows":40');
  });

  test("replays session.opened to a viewer that joins after the host announced it", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });

    // Host announces the session once, before any viewer is connected.
    hub.routeInbound(
      host,
      JSON.stringify({
        type: "session.opened",
        sessionId: "s1",
        size: { cols: 80, rows: 24 },
      }),
    );

    // A viewer joins afterwards: it must still receive session.opened so its
    // client learns the sessionId and can forward input.
    const lateViewer = new FakePeer();
    hub.bind({ peer: lateViewer, role: "viewer", sessionId: "s1" });

    expect(lateViewer.sent).toHaveLength(1);
    expect(lateViewer.sent[0]).toContain('"type":"session.opened"');

    // And that viewer's input now reaches the host.
    hub.routeInbound(lateViewer, JSON.stringify({ type: "input", sessionId: "s1", data: "x" }));
    expect(host.sent.at(-1)).toContain('"type":"input"');
  });

  test("relays WebRTC signaling to the correct peer and stamps an authoritative id", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewerA = new FakePeer();
    const viewerB = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewerA, role: "viewer", sessionId: "s1" });
    hub.bind({ peer: viewerB, role: "viewer", sessionId: "s1" });

    // Viewer A offers; relay forwards to host and overwrites the spoofed `from`.
    hub.routeInbound(
      viewerA,
      JSON.stringify({
        type: "signal",
        sessionId: "s1",
        to: "host",
        from: "spoofed",
        kind: "offer",
        data: "OFFER",
      }),
    );
    expect(host.sent).toHaveLength(1);
    const forwarded = JSON.parse(host.sent[0] as string);
    expect(forwarded.type).toBe("signal");
    expect(forwarded.to).toBe("host");
    expect(forwarded.from).not.toBe("spoofed");
    const peerId = forwarded.from as string;

    // Host answers that peerId; only viewer A receives it.
    hub.routeInbound(
      host,
      JSON.stringify({
        type: "signal",
        sessionId: "s1",
        to: peerId,
        from: "host",
        kind: "answer",
        data: "ANSWER",
      }),
    );
    expect(viewerA.sent.some((s) => s.includes('"kind":"answer"'))).toBe(true);
    expect(viewerB.sent.some((s) => s.includes('"kind":"answer"'))).toBe(false);
  });

  test("drops a host signal addressed to an unknown peer", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewer = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewer, role: "viewer", sessionId: "s1" });

    hub.routeInbound(
      host,
      JSON.stringify({
        type: "signal",
        sessionId: "s1",
        to: "no-such-peer",
        from: "host",
        kind: "answer",
        data: "ANSWER",
      }),
    );
    expect(viewer.sent.some((s) => s.includes('"kind":"answer"'))).toBe(false);
  });

  test("host disconnect notifies and closes viewers", () => {
    const hub = new RelayHub(noopLog);
    const host = new FakePeer();
    const viewer = new FakePeer();
    hub.bind({ peer: host, role: "host", sessionId: "s1" });
    hub.bind({ peer: viewer, role: "viewer", sessionId: "s1" });

    hub.unbind(host);

    expect(viewer.sent.at(-1)).toContain('"type":"session.closed"');
    expect(viewer.closedWith?.reason).toBe("host disconnected");
  });
});
