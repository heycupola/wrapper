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
