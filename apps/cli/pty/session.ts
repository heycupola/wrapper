import { EventEmitter } from "node:events";
import { Terminal } from "@repo/terminal";
import type { SessionStatus, TerminalSize } from "@repo/protocol";

// PTY lifecycle wrapper. Uses @repo/terminal (helper-backed) so Ctrl+C/Ctrl+Z
// signal delivery follows kernel line discipline for foreground process groups.

export interface PtySessionOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  size?: TerminalSize;
}

interface PtySessionEvents {
  data: [chunk: string];
  exit: [exitCode: number | null];
  error: [error: Error];
}

const DEFAULT_SHELL = "/bin/bash";
const DEFAULT_SIZE: TerminalSize = { cols: 80, rows: 24 };

// Keep a tail so late attachers can see a recent frame.
const REPLAY_BUFFER_BYTES = 256 * 1024;

export class PtySession extends EventEmitter<PtySessionEvents> {
  private terminal: Terminal | null = null;
  private currentSize: TerminalSize;
  private state: SessionStatus = "idle";
  private exitCode: number | null = null;
  private replayLog = "";
  private readonly decoder = new TextDecoder("utf-8");

  constructor(opts: PtySessionOptions = {}) {
    super();
    this.currentSize = opts.size ?? DEFAULT_SIZE;
    this.spawn(opts);
  }

  write(data: string): void {
    if (this.state !== "running") return;
    if (!this.terminal) return;
    try {
      this.terminal.write(data);
    } catch (err) {
      this.emit("error", asError(err, "pty:write"));
    }
  }

  resize(size: TerminalSize): void {
    if (this.state !== "running") return;
    if (!this.terminal) return;
    if (size.cols === this.currentSize.cols && size.rows === this.currentSize.rows) {
      return;
    }
    this.currentSize = size;
    try {
      this.terminal.resize(size.cols, size.rows);
    } catch (err) {
      this.emit("error", asError(err, "pty:resize"));
    }
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (this.state === "exiting" || this.state === "closed") return;
    this.state = "exiting";
    if (!this.terminal) return;
    try {
      this.terminal.kill(signal);
    } catch (err) {
      this.emit("error", asError(err, "pty:kill"));
    }
  }

  // Best-effort redraw trigger for late attach/resizes.
  requestRedraw(): void {
    if (this.state !== "running") return;
    const fg = this.foregroundProcessGroup;
    if (fg <= 0) return;
    try {
      // Negative pid sends to process group.
      process.kill(-fg, "SIGWINCH");
    } catch {
      // Ignore race with process exit.
    }
  }

  get replayBuffer(): string {
    return this.replayLog;
  }

  get pid(): number | null {
    return this.terminal?.pid ?? null;
  }

  get status(): SessionStatus {
    return this.state;
  }

  get foregroundProcessGroup(): number {
    return this.terminal?.foregroundProcessGroup ?? -1;
  }

  get isIdle(): boolean {
    const fg = this.foregroundProcessGroup;
    const pid = this.pid;
    return fg > 0 && pid !== null && fg === pid;
  }

  get size(): TerminalSize {
    return this.currentSize;
  }

  get lastExitCode(): number | null {
    return this.exitCode;
  }

  private spawn(opts: PtySessionOptions): void {
    const shell = opts.shell ?? process.env["SHELL"] ?? DEFAULT_SHELL;
    // Force interactive shell behavior.
    const args = isInteractiveShellPath(shell) ? ["-i"] : [];
    const env = {
      ...process.env,
      ...opts.env,
      TERM: opts.env?.["TERM"] ?? process.env["TERM"] ?? "xterm-256color",
    };

    try {
      this.terminal = new Terminal({
        cmd: [shell, ...args],
        size: this.currentSize,
        cwd: opts.cwd ?? process.cwd(),
        env,
        onData: (chunk) => {
          if (this.state !== "running") return;
          const text = this.decoder.decode(chunk, { stream: true });
          if (text.length === 0) return;
          this.recordOutput(text);
          this.emit("data", text);
        },
        onExit: ({ exitCode }) => {
          this.exitCode = exitCode;
          this.finalize();
        },
      });
    } catch (err) {
      this.state = "closed";
      // Defer emits to a microtask: the constructor returns first so callers
      // can attach `error`/`exit` listeners. Emitting synchronously here would
      // throw on the unlistened `error` event and lose `exit`, hanging the host.
      // Callers can also detect failure synchronously via `status === "closed"`.
      queueMicrotask(() => {
        this.emit("error", asError(err, "pty:spawn"));
        this.emit("exit", null);
      });
      return;
    }

    this.state = "running";
  }

  private recordOutput(text: string): void {
    this.replayLog += text;
    if (this.replayLog.length > REPLAY_BUFFER_BYTES * 2) {
      this.replayLog = this.replayLog.slice(-REPLAY_BUFFER_BYTES);
    }
  }

  private finalize(): void {
    if (this.state === "closed") return;
    this.state = "closed";

    // Flush any buffered utf8 bytes before exit.
    const tail = this.decoder.decode();
    if (tail.length > 0) {
      this.recordOutput(tail);
      this.emit("data", tail);
    }

    if (this.terminal) {
      try {
        this.terminal.close();
      } catch {
        // Already closed; safe to ignore.
      }
      this.terminal = null;
    }

    this.emit("exit", this.exitCode);
  }
}

const INTERACTIVE_SHELLS = new Set(["zsh", "bash", "fish", "sh", "dash", "ksh"]);

function isInteractiveShellPath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return INTERACTIVE_SHELLS.has(base);
}

function asError(err: unknown, scope: string): Error {
  if (err instanceof Error) {
    err.message = `${scope}: ${err.message}`;
    return err;
  }
  return new Error(`${scope}: ${String(err)}`);
}
