import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { ServerWebSocket } from "bun";
import { encodeMessage, type TerminalSize } from "@repo/protocol";
import type { PtySession } from "../pty/session";
import { startRelayHostBridge } from "../relay/host-bridge";

/**
 * Remote viewer sizes must leave the PTY consensus whenever the viewer can no
 * longer be displaying the PTY, otherwise a stale phone grid pins the host
 * terminal small forever.
 */

class FakePty extends EventEmitter {
  readonly size: TerminalSize = { cols: 80, rows: 24 };
  readonly replayBuffer = "";
  readonly participants = new Map<string, TerminalSize>();
  setParticipantSize(id: string, size: TerminalSize): void {
    this.participants.set(id, size);
  }
  removeParticipant(id: string): void {
    this.participants.delete(id);
  }
  removeParticipantsWithPrefix(prefix: string): void {
    for (const id of this.participants.keys())
      if (id.startsWith(prefix)) this.participants.delete(id);
  }
  requestRedraw(): void {}
  write(): void {}
}

const SESSION_ID = "ABCDEFGHJKLM";

async function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    // eslint-disable-next-line no-await-in-loop
    await Bun.sleep(10);
  }
}

function startFakeRelay(onHost: (ws: ServerWebSocket<unknown>) => void) {
  return Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req, srv) {
      if (srv.upgrade(req, { data: {} })) return undefined;
      return new Response("upgrade required", { status: 426 });
    },
    websocket: {
      open: onHost,
      message() {},
    },
  });
}

async function stopRelay(relay: ReturnType<typeof startFakeRelay>): Promise<void> {
  // Bun's server.stop can hang right after a socket disconnect (see server/local.ts).
  await Promise.race([relay.stop(true), Bun.sleep(250)]);
}

function resizeFrom(peerId: string, cols: number, rows: number): string {
  return encodeMessage({
    type: "resize",
    sessionId: SESSION_ID,
    size: { cols, rows },
    from: peerId,
  });
}

describe("relay host bridge viewer sizes", () => {
  test("a viewer detach lifts its size", async () => {
    let host: ServerWebSocket<unknown> | null = null;
    const relay = startFakeRelay((ws) => {
      host = ws;
    });
    const pty = new FakePty();
    const bridge = startRelayHostBridge({
      relayUrl: `http://127.0.0.1:${relay.port}`,
      ticket: "t",
      sessionId: SESSION_ID,
      pty: pty as unknown as PtySession,
    });
    try {
      await waitFor(() => host !== null);
      host!.send(resizeFrom("phone", 110, 14));
      await waitFor(() => pty.participants.has("relay:phone"));
      expect(pty.participants.get("relay:phone")).toEqual({ cols: 110, rows: 14 });

      host!.send(encodeMessage({ type: "detach", sessionId: SESSION_ID, from: "phone" }));
      await waitFor(() => !pty.participants.has("relay:phone"));
    } finally {
      await bridge.stop();
      await stopRelay(relay);
    }
  });

  test("losing the relay socket drops viewers that have no P2P channel", async () => {
    let host: ServerWebSocket<unknown> | null = null;
    const relay = startFakeRelay((ws) => {
      host = ws;
    });
    const pty = new FakePty();
    const bridge = startRelayHostBridge({
      relayUrl: `http://127.0.0.1:${relay.port}`,
      ticket: "t",
      sessionId: SESSION_ID,
      pty: pty as unknown as PtySession,
    });
    try {
      await waitFor(() => host !== null);
      host!.send(resizeFrom("phone", 110, 14));
      host!.send(resizeFrom("tablet", 150, 40));
      await waitFor(() => pty.participants.size === 2);

      // The relay closes every viewer when the host socket drops, but it can no
      // longer tell the host, so the bridge must drop the sizes itself.
      host!.close();
      await waitFor(() => pty.participants.size === 0);
    } finally {
      await bridge.stop();
      await stopRelay(relay);
    }
  });
});
