/*
 * Integration tests for @repo/terminal.
 *
 * Each test allocates a real PTY pair via posix_openpt and spawns
 * /bin/bash inside it through wrapper-pty-helper. We rely on bash
 * being on PATH (it is on every macOS / mainstream Linux host).
 *
 * The tests assert the contracts that matter for the Wrapper CLI:
 *
 *   - basic write/read round-trip
 *   - resize propagates to the slave (`stty size` reports new dims)
 *   - Ctrl+C delivered as a raw byte kills the foreground job (proves
 *     the kernel's line discipline is wired correctly)
 *   - foregroundProcessGroup tracks the foreground pgid
 *   - `exited` resolves and `onExit` fires
 */

import { afterEach, describe, expect, test } from "bun:test";

import { Terminal } from "../terminal";

const SLOW = process.env["CI"] ? 1.5 : 1;

type Recorder = {
  text: string;
  /** Resolves when the recorded text matches `predicate`, or rejects after `timeoutMs`. */
  waitFor(predicate: (s: string) => boolean, timeoutMs?: number): Promise<string>;
  reset(): void;
};

function makeRecorder(): {
  recorder: Recorder;
  onData: (chunk: Uint8Array) => void;
} {
  const decoder = new TextDecoder();
  const waiters: Array<{
    predicate: (s: string) => boolean;
    resolve: (s: string) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  const recorder: Recorder = {
    text: "",
    waitFor(predicate, timeoutMs = 4000 * SLOW) {
      return new Promise<string>((resolve, reject) => {
        if (predicate(recorder.text)) return resolve(recorder.text);
        const timer = setTimeout(() => {
          const idx = waiters.findIndex((w) => w.timer === timer);
          if (idx !== -1) waiters.splice(idx, 1);
          reject(
            new Error(
              `recorder.waitFor timed out after ${timeoutMs}ms; text was: ${JSON.stringify(
                recorder.text.slice(-300),
              )}`,
            ),
          );
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
    reset() {
      recorder.text = "";
    },
  };

  const onData = (chunk: Uint8Array): void => {
    recorder.text += decoder.decode(chunk);
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (!w) continue;
      if (w.predicate(recorder.text)) {
        clearTimeout(w.timer);
        w.resolve(recorder.text);
        waiters.splice(i, 1);
      }
    }
  };

  return { recorder, onData };
}

const trackedTerminals: Terminal[] = [];

function makeTerm(opts?: Partial<ConstructorParameters<typeof Terminal>[0]>): {
  term: Terminal;
  rec: Recorder;
} {
  const { recorder, onData } = makeRecorder();
  const term = new Terminal({
    cmd: ["/bin/bash", "--norc", "--noprofile", "-i"],
    env: { ...process.env, PS1: "READY$ ", TERM: "dumb" },
    onData,
    ...opts,
  });
  trackedTerminals.push(term);
  return { term, rec: recorder };
}

afterEach(async () => {
  for (const term of trackedTerminals.splice(0)) {
    try {
      term.kill("SIGKILL");
    } catch {
      // ignore
    }
    try {
      term.close();
    } catch {
      // ignore
    }
  }
});

describe("Terminal", () => {
  test("spawns a shell and returns a PID", () => {
    const { term } = makeTerm();
    expect(typeof term.pid).toBe("number");
    expect(term.pid).toBeGreaterThan(0);
  });

  test("write() round-trips through the shell", async () => {
    const { term, rec } = makeTerm();
    await rec.waitFor((s) => s.includes("READY$"));
    rec.reset();
    term.write("echo hello-world\n");
    const out = await rec.waitFor((s) => s.includes("hello-world"));
    expect(out).toContain("hello-world");
  });

  test("resize() propagates to the slave", async () => {
    const { term, rec } = makeTerm({ size: { cols: 80, rows: 24 } });
    await rec.waitFor((s) => s.includes("READY$"));
    rec.reset();
    term.write("stty size\n");
    const initial = await rec.waitFor((s) => /\b24 80\b/.test(s));
    expect(initial).toMatch(/\b24 80\b/);

    term.resize(120, 40);
    rec.reset();
    term.write("stty size\n");
    const resized = await rec.waitFor((s) => /\b40 120\b/.test(s));
    expect(resized).toMatch(/\b40 120\b/);
  });

  test("Ctrl+C kills the foreground job (kernel line discipline)", async () => {
    const { term, rec } = makeTerm();
    await rec.waitFor((s) => s.includes("READY$"));
    rec.reset();

    /*
     * `&&` is intentional: if the kernel does NOT generate SIGINT,
     * `sleep` exits cleanly after 10 s and `echo IT_FINISHED` runs.
     * If SIGINT works, sleep is killed before the echo and IT_FINISHED
     * never appears anywhere except in the echoed user command line.
     * We use a marker shell variable inside the echo so the *output*
     * of the printed string and the *user-typed command line* are
     * distinguishable in the recorded transcript.
     */
    term.write("sleep 10 && printf IT_FIN%s\\\\n ISHED\n");
    await Bun.sleep(400 * SLOW);
    const fgDuring = term.foregroundProcessGroup;
    expect(fgDuring).toBeGreaterThan(0);
    expect(fgDuring).not.toBe(term.pid);

    const start = Date.now();
    rec.reset();
    term.write("\x03"); // Ctrl+C
    await rec.waitFor((s) => s.includes("READY$"));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000 * SLOW);
    // The post-Ctrl+C transcript must NOT include the printf output.
    expect(rec.text).not.toContain("IT_FINISHED");
  });

  test("foregroundProcessGroup returns the shell pid when idle", async () => {
    const { term, rec } = makeTerm();
    await rec.waitFor((s) => s.includes("READY$"));
    expect(term.foregroundProcessGroup).toBe(term.pid);
  });

  test("kill() terminates the shell and resolves `exited`", async () => {
    const { term, rec } = makeTerm();
    await rec.waitFor((s) => s.includes("READY$"));
    /*
     * Interactive bash ignores SIGTERM by default — it's a deliberate
     * misfeature so accidentally typing `kill <shell-pid>` doesn't
     * blow up your terminal. Use SIGKILL here so the test passes
     * deterministically; users who want SIGTERM semantics for their
     * own shells call `kill()` themselves with their preferred signal.
     */
    term.kill("SIGKILL");
    const result = await Promise.race([
      term.exited,
      Bun.sleep(2000 * SLOW).then(() => "timeout" as const),
    ]);
    expect(result).not.toBe("timeout");
  });

  test("close() is idempotent", () => {
    const { term } = makeTerm();
    term.close();
    term.close();
    term.close();
  });

  test("onExit fires with exit info", async () => {
    let exitInfo: { exitCode: number | null; signalCode: number | null } | null = null;
    const { term } = makeTerm({
      onExit: (info) => {
        exitInfo = info;
      },
    });
    term.write("exit 7\n");
    await Promise.race([term.exited, Bun.sleep(2000 * SLOW)]);
    expect(exitInfo).not.toBeNull();
  });
});
