import { describe, expect, test } from "bun:test";
import { createSessionId, encodeMessage, parseMessage } from "@repo/protocol";
import { PtySession } from "../pty/session";
import { startLocalServer } from "../server/local";

/**
 * Happy-path end-to-end coverage for the core product flow:
 *
 *   PtySession (real shell in a PTY)
 *     -> startLocalServer (WS fan-out)
 *       -> a WebSocket client sends `input`
 *         -> shell runs it
 *           -> `output` streams back to the client over the protocol
 *
 * This exercises the exact same path a local `wrapper attach` uses, minus
 * the raw-mode stdin bridging (which is not testable headlessly). Relay and
 * backend auth are intentionally out of scope here; this guards the inner
 * loop that everything else builds on.
 */

const MARKER = "wrapper-e2e-ok";

describe("host attach happy path", () => {
  test("viewer input runs in the shell and output streams back", async () => {
    const sessionId = createSessionId();
    const pty = new PtySession({
      shell: "/bin/bash",
      size: { cols: 80, rows: 24 },
    });
    const server = startLocalServer({ port: 0, sessionId, pty });

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    let received = "";
    const sawMarker = new Promise<void>((resolve) => {
      ws.addEventListener("message", (event) => {
        const data = typeof event.data === "string" ? event.data : "";
        const msg = parseMessage(data);
        if (msg?.type === "output") {
          received += msg.data;
          if (received.includes(MARKER)) resolve();
        }
      });
    });

    // Re-send the command until output appears so the test does not race
    // interactive shell startup (rc sourcing, prompt setup) on slow runners.
    let resend: ReturnType<typeof setInterval> | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve(), { once: true });
        ws.addEventListener("error", () => reject(new Error("ws failed to open")), {
          once: true,
        });
      });

      const sendEcho = (): void => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encodeMessage({ type: "input", sessionId, data: `echo ${MARKER}\n` }));
        }
      };
      sendEcho();
      resend = setInterval(sendEcho, 750);

      await Promise.race([
        sawMarker,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timed out waiting for shell output")), 10000),
        ),
      ]);

      expect(received).toContain(MARKER);
    } finally {
      if (resend) clearInterval(resend);
      try {
        ws.close();
      } catch {
        // already closed
      }
      pty.kill();
      await server.stop();
    }
  }, 15000);
});
