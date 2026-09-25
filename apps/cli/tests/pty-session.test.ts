import { describe, expect, test } from "bun:test";
import { PtySession } from "../pty/session";

/**
 * Regression guard for the spawn-failure lifecycle (Finding 5): an `exit`
 * listener attached *after* construction must still observe termination, and
 * the session must never leave a caller awaiting an event that already fired.
 * A nonexistent shell makes the PTY helper fail `execvp` and exit non-zero.
 */
describe("PtySession failure lifecycle", () => {
  test("late exit listener still observes termination of a failing shell", async () => {
    const session = new PtySession({ shell: "/nonexistent/wrapper-bad-shell" });
    // Never let an emitted error event throw and crash the test runner.
    session.on("error", () => {});

    const exitCode = await new Promise<number | null>((resolve) => {
      if (session.status === "closed") {
        resolve(session.lastExitCode);
        return;
      }
      session.once("exit", (code) => resolve(code));
    });

    expect(session.status).toBe("closed");
    expect(exitCode === null || typeof exitCode === "number").toBe(true);
  });
});

/**
 * The PTY is painted on every participant's terminal at once (the host's own
 * window or tmux pane, local attach clients, phones over the relay). It must
 * therefore never exceed the smallest of them: a phone in landscape is wider
 * than an 80-column terminal, and a PTY resized to the phone makes the host
 * terminal wrap and garble every full-screen redraw.
 */
describe("PtySession size consensus", () => {
  test("fits the smallest participant and grows back when it leaves", async () => {
    const session = new PtySession({ shell: "/bin/bash", size: { cols: 80, rows: 24 } });
    session.on("error", () => {});
    try {
      expect(session.status).toBe("running");
      session.setParticipantSize("host-terminal", { cols: 80, rows: 24 });
      expect(session.size).toEqual({ cols: 80, rows: 24 });

      // Landscape phone: wider but shorter than the host terminal.
      session.setParticipantSize("relay:phone", { cols: 110, rows: 14 });
      expect(session.size).toEqual({ cols: 80, rows: 14 });
      expect(session.consensusSize).toEqual({ cols: 80, rows: 14 });

      // Portrait phone: narrower and taller than landscape.
      session.setParticipantSize("relay:phone", { cols: 46, rows: 30 });
      expect(session.size).toEqual({ cols: 46, rows: 24 });

      // A second local client narrower still.
      session.setParticipantSize("local:2", { cols: 40, rows: 40 });
      expect(session.size).toEqual({ cols: 40, rows: 24 });

      session.removeParticipant("local:2");
      expect(session.size).toEqual({ cols: 46, rows: 24 });

      session.removeParticipantsWithPrefix("relay:");
      expect(session.size).toEqual({ cols: 80, rows: 24 });

      // Host window grows: with no viewers the PTY follows it.
      session.setParticipantSize("host-terminal", { cols: 120, rows: 40 });
      expect(session.size).toEqual({ cols: 120, rows: 40 });

      // Losing every participant keeps the last size rather than guessing.
      session.removeParticipant("host-terminal");
      expect(session.consensusSize).toBeNull();
      expect(session.size).toEqual({ cols: 120, rows: 40 });

      // Non-positive sizes are ignored, never applied.
      session.setParticipantSize("relay:bad", { cols: 0, rows: 10 });
      expect(session.consensusSize).toBeNull();
    } finally {
      // Interactive bash ignores SIGTERM; make teardown deterministic.
      session.kill("SIGKILL");
      await new Promise<void>((resolve) => {
        if (session.status === "closed") return resolve();
        session.once("exit", () => resolve());
      });
    }
  }, 15000);
});
