/*
 * Terminal — a small PTY wrapper that mimics Bun.Terminal's surface
 * area while routing through wrapper-pty-helper so kernel line
 * discipline (SIGINT/SIGTSTP/SIGQUIT) actually works.
 *
 * Layout:
 *
 *   master fd ─┬── read loop  → onData
 *              └── write       ← Terminal.write()
 *
 *              spawn(helper) ──► setsid + TIOCSCTTY + dup2 + execvp
 *                                   │
 *                                   └── shell process tree
 *
 * The class hides the fd machinery from callers: construct, attach
 * onData, write/resize as needed, await `exited`, then call close()
 * (close happens automatically on exit too).
 */

import { ptr } from "bun:ffi";

import { resolveHelperPath } from "./helper";
import { libc, O_NOCTTY, O_NONBLOCK, O_RDWR } from "./libc";

export type TerminalSize = {
  cols: number;
  rows: number;
};

export type TerminalOptions = {
  /** argv to exec inside the PTY — argv[0] must be the binary path. */
  cmd: [string, ...string[]];
  /** Initial size; defaults to 80x24 if omitted. */
  size?: TerminalSize;
  /** Working directory for the spawned shell; defaults to process.cwd(). */
  cwd?: string;
  /** Environment for the spawned shell; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Called for every chunk read from the master fd. */
  onData?: (chunk: Uint8Array) => void;
  /** Called once the spawned shell exits. */
  onExit?: (info: { exitCode: number | null; signalCode: number | null }) => void;
  /**
   * Polling interval in ms between read attempts when the master fd
   * has no data ready. Smaller = lower latency, higher CPU. Default 4ms.
   */
  pollIntervalMs?: number;
};

const READ_BUF_SIZE = 64 * 1024;
const DEFAULT_POLL_MS = 4;

export class Terminal {
  /** Process id of the helper-spawned shell. */
  readonly pid: number;
  /** Promise that resolves with the shell's exit info. */
  readonly exited: Promise<{ exitCode: number | null; signalCode: number | null }>;

  private masterFd: number;
  private readonly slavePath: string;
  private size: TerminalSize;
  private readonly process: ReturnType<typeof Bun.spawn>;
  private readonly readBuffer: Uint8Array;
  private closed = false;
  private readLoopRunning = false;
  private readonly onData?: TerminalOptions["onData"];
  private readonly onExit?: TerminalOptions["onExit"];
  private readonly pollIntervalMs: number;

  constructor(opts: TerminalOptions) {
    if (!opts.cmd || opts.cmd.length === 0) {
      throw new Error("Terminal: cmd must contain at least one entry");
    }

    this.size = opts.size ?? { cols: 80, rows: 24 };
    this.onData = opts.onData;
    this.onExit = opts.onExit;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.readBuffer = new Uint8Array(READ_BUF_SIZE);

    /*
     * 1. Allocate a PTY pair. We open the master with O_NONBLOCK so
     *    the read loop never blocks Bun's event loop, and with
     *    O_NOCTTY because the wrapper process must not adopt this
     *    PTY as its own controlling terminal.
     */
    const flags = O_RDWR | O_NOCTTY | O_NONBLOCK;
    const masterFd = libc.posix_openpt(flags);
    if (masterFd < 0) {
      throw new Error(`Terminal: posix_openpt failed (errno via FFI)`);
    }
    if (libc.grantpt(masterFd) < 0) {
      libc.close(masterFd);
      throw new Error("Terminal: grantpt failed");
    }
    if (libc.unlockpt(masterFd) < 0) {
      libc.close(masterFd);
      throw new Error("Terminal: unlockpt failed");
    }
    const slavePathRaw = libc.ptsname(masterFd);
    const slavePath = String(slavePathRaw);
    if (!slavePath || slavePath.length === 0) {
      libc.close(masterFd);
      throw new Error("Terminal: ptsname returned empty string");
    }

    this.masterFd = masterFd;
    this.slavePath = slavePath;

    /*
     * 2. Spawn the helper. The helper performs setsid + TIOCSCTTY +
     *    optional initial-winsize ioctl + dup2(slave) + execvp(cmd).
     *    We hand it argv exactly as the caller wants the shell
     *    invoked, and pass the requested size via env vars so the
     *    helper can apply it inside its own process — that way we
     *    avoid any race between "parent runs stty" and "helper opens
     *    slave (which on macOS clears the winsize on first open)".
     */
    const helperPath = resolveHelperPath();
    const helperArgv = [helperPath, slavePath, ...opts.cmd];

    const childEnv = cleanEnv(opts.env ?? process.env);
    childEnv["WRAPPER_PTY_ROWS"] = String(this.size.rows);
    childEnv["WRAPPER_PTY_COLS"] = String(this.size.cols);

    this.process = Bun.spawn(helperArgv, {
      cwd: opts.cwd ?? process.cwd(),
      env: childEnv,
      stdio: ["ignore", "ignore", "ignore"],
    });

    this.pid = this.process.pid;

    /*
     * 3. When the helper exits, the underlying shell exited (the
     *    helper exec'd into it). Surface the result, kick the read
     *    loop one last time so we don't lose buffered output, then
     *    close the master fd.
     */
    this.exited = this.process.exited.then((exitCode) => {
      const info = {
        exitCode: exitCode ?? null,
        signalCode: this.process.signalCode ? signalNumberFromName(this.process.signalCode) : null,
      };
      // Drain whatever's left on the master fd, then tear down.
      this.drainOnce();
      this.close();
      this.onExit?.(info);
      return info;
    });

    /*
     * 4. Start the polling read loop. Bun.FFI doesn't expose epoll/kqueue,
     *    so we fall back to non-blocking reads + a short sleep. With
     *    a 4ms poll the throughput is fine for interactive shells and
     *    the wakeup cost is negligible.
     */
    void this.runReadLoop();
  }

  /** Writes raw bytes to the master fd (host → shell stdin). */
  write(data: string | Uint8Array): void {
    if (this.closed) return;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (bytes.byteLength === 0) return;
    libc.write(this.masterFd, ptr(bytes), BigInt(bytes.byteLength));
  }

  /** Updates the PTY winsize. Triggers SIGWINCH inside the slave. */
  resize(cols: number, rows: number): void {
    if (this.closed) return;
    if (cols <= 0 || rows <= 0) return;
    if (cols === this.size.cols && rows === this.size.rows) return;
    this.size = { cols, rows };
    this.applyWinsize(this.size);
  }

  /**
   * Returns the current foreground process group attached to the
   * slave, or -1 if none. Useful for diagnostics and future features
   * (e.g. detecting whether the user is inside a TUI).
   */
  get foregroundProcessGroup(): number {
    if (this.closed) return -1;
    return libc.tcgetpgrp(this.masterFd);
  }

  /** Sends a signal to the spawned shell. */
  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (this.closed) return;
    try {
      this.process.kill(signal);
    } catch {
      // process may already be gone; ignore.
    }
  }

  /**
   * Closes the master fd and stops the read loop. Idempotent. Note
   * that closing the master delivers SIGHUP to the slave's session,
   * which terminates the shell if it hasn't already exited.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    libc.close(this.masterFd);
    this.masterFd = -1;
  }

  // ---------------------------------------------------------------------------

  private applyWinsize(size: TerminalSize): void {
    /*
     * Setting the PTY's winsize from JS is annoying on every front:
     *
     *   • macOS rejects TIOCSWINSZ on the master fd (ENOTTY).
     *   • bun:ffi's varargs handling for ioctl(2) appears to mangle
     *     the third argument — even when the syscall returns 0, the
     *     winsize doesn't actually change.
     *
     * `stty -f <slave-path> rows R cols C` is portable, fast (a few
     * milliseconds via spawnSync on every host we target), and
     * avoids the FFI quirks entirely. Resize is a rare, debounced
     * event so the spawn cost is fine.
     */
    const result = Bun.spawnSync({
      cmd: [
        "stty",
        process.platform === "darwin" ? "-f" : "-F",
        this.slavePath,
        "rows",
        String(size.rows),
        "cols",
        String(size.cols),
      ],
      stdio: ["ignore", "ignore", "ignore"],
    });
    if (!result.success && process.env["DEV"] === "true") {
      console.error("[@repo/terminal] stty resize failed", {
        size,
        slavePath: this.slavePath,
      });
    }
  }

  private async runReadLoop(): Promise<void> {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    try {
      while (!this.closed) {
        const got = this.drainOnce();
        if (got === 0) {
          /*
           * Sequential await is intentional: we MUST yield to the event
           * loop between non-blocking read attempts, otherwise we burn
           * a CPU core spinning on a fd that has nothing pending.
           * Promise.all-style parallelism makes no sense here; this is
           * a polling loop with deliberate back-pressure.
           */
          // eslint-disable-next-line no-await-in-loop
          await Bun.sleep(this.pollIntervalMs);
        }
      }
    } finally {
      this.readLoopRunning = false;
    }
  }

  /**
   * Pulls every byte currently available on the master fd. Returns
   * the total number of bytes drained (zero when nothing was ready).
   * Tolerates closed/EOF conditions silently.
   */
  private drainOnce(): number {
    if (this.closed || this.masterFd < 0) return 0;
    let total = 0;
    for (;;) {
      const n = Number(libc.read(this.masterFd, ptr(this.readBuffer), BigInt(READ_BUF_SIZE)));
      if (n > 0) {
        total += n;
        // Slice into a fresh Uint8Array so the consumer can hold it
        // safely past the next read iteration.
        const chunk = new Uint8Array(n);
        chunk.set(this.readBuffer.subarray(0, n));
        try {
          this.onData?.(chunk);
        } catch (err) {
          // Never let a consumer exception kill the read loop.
          // Surface to stderr in dev only.
          if (process.env["DEV"] === "true") {
            console.error("[@repo/terminal] onData threw:", err);
          }
        }
        continue;
      }
      // n <= 0: would block, EOF, or error. We treat them all the same
      // and bail out of the inner drain to let the caller idle/retry.
      return total;
    }
  }
}

function cleanEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Maps a POSIX signal name (`"SIGINT"`) to its numeric code. Only the
 * signals we plausibly observe are listed; anything else returns
 * null and surfaces as `signalCode: null`.
 */
function signalNumberFromName(name: NodeJS.Signals): number | null {
  switch (name) {
    case "SIGHUP":
      return 1;
    case "SIGINT":
      return 2;
    case "SIGQUIT":
      return 3;
    case "SIGKILL":
      return 9;
    case "SIGTERM":
      return 15;
    case "SIGTSTP":
      return 18;
    default:
      return null;
  }
}
