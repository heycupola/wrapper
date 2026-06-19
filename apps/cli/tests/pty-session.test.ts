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
