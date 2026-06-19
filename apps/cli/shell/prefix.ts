/**
 * Wrapper's keystroke prefix.
 *
 * The user keeps using their shell normally. When they want to invoke a
 * Wrapper-side action, they press a dedicated prefix key followed by a
 * one-letter command:
 *
 *   <prefix> s   share   — open the relay tunnel (host only)
 *   <prefix> u   unshare — close the relay tunnel (host only)
 *   <prefix> d   detach  — disconnect this viewer; session keeps running
 *                          (attach client only; host treats it as a no-op
 *                          with a hint to use `exit` instead).
 *   <prefix> ?   status  — print a one-line summary
 *   <prefix> <prefix>    — pass the literal prefix byte through to the shell
 *   <prefix> Esc         — cancel command mode silently
 *
 * The default prefix is `Ctrl+\` (0x1C). It is rarely bound to anything in
 * shells, terminal emulators, or tmux, which keeps collisions to a minimum.
 *
 * Critical invariants the filter must honour, so users can keep using
 * their shell normally even if they accidentally hit the prefix:
 *
 *   1. The "armed" state auto-resets after a short timeout. Without a
 *      timeout, a stray prefix byte (e.g. inside pasted text) would keep
 *      the filter armed and silently eat every subsequent keystroke,
 *      including Ctrl+C and Ctrl+Z, leaving the user unable to recover.
 *
 *   2. When the next byte after the prefix is not a recognised command,
 *      the filter must NOT swallow it. Both the prefix and the byte are
 *      forwarded to the shell so nothing the user typed disappears.
 *
 *   3. Common control bytes (Ctrl+C 0x03, Ctrl+Z 0x1A, Ctrl+D 0x04)
 *      always reach the shell. They are not the prefix, so they pass
 *      through trivially in the idle state.
 */

export type PrefixCommand = "share" | "unshare" | "status" | "detach";

export interface PrefixFilterOptions {
  /** Prefix byte. Defaults to 0x1C (Ctrl+\). */
  prefix?: number;
  /** Called when the user completes a recognised <prefix><cmd> sequence. */
  onCommand: (cmd: PrefixCommand) => void;
  /** Called when the filter enters or leaves "armed" state — useful for
   *  rendering an overlay hint. Defaults to a no-op. */
  onArmedChange?: (armed: boolean) => void;
  /** Called to forward bytes to the shell out-of-band — used to re-emit the
   *  prefix byte when the armed state times out without a follow-up command,
   *  so the keystroke is never silently dropped. Defaults to a no-op. */
  onForward?: (data: string) => void;
  /** Auto-reset the armed state after this many milliseconds. Defaults to
   *  1500. Set to 0 to disable the timeout (not recommended). */
  armedTimeoutMs?: number;
}

const DEFAULT_PREFIX = 0x1c; // Ctrl+\
const DEFAULT_TIMEOUT_MS = 1500;

const CMD_SHARE = 0x73; // 's'
const CMD_UNSHARE = 0x75; // 'u'
const CMD_STATUS_Q = 0x3f; // '?'
const CMD_DETACH = 0x64; // 'd'
const ESC_BYTE = 0x1b;

type State = "idle" | "armed";

export class PrefixFilter {
  private readonly prefix: number;
  private readonly onCommand: (cmd: PrefixCommand) => void;
  private readonly onArmedChange: (armed: boolean) => void;
  private readonly onForward: (data: string) => void;
  private readonly timeoutMs: number;
  private state: State = "idle";
  private armedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: PrefixFilterOptions) {
    this.prefix = opts.prefix ?? DEFAULT_PREFIX;
    this.onCommand = opts.onCommand;
    this.onArmedChange = opts.onArmedChange ?? (() => undefined);
    this.onForward = opts.onForward ?? (() => undefined);
    this.timeoutMs = opts.armedTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Process a chunk of input bytes. Returns the bytes the inner shell
   * should still see. Bytes recognised as prefix commands are stripped;
   * everything else (including the prefix byte itself if no recognised
   * command follows) is forwarded.
   */
  process(input: string): string {
    if (input.length === 0) return input;

    let out = "";
    for (const ch of input) {
      const byte = ch.charCodeAt(0);

      if (this.state === "idle") {
        if (byte === this.prefix) {
          this.arm();
          continue;
        }
        out += ch;
        continue;
      }

      // armed state — interpret the next byte as a command
      this.disarm();

      if (byte === this.prefix) {
        // <prefix><prefix> = literal prefix byte to the shell
        out += String.fromCharCode(this.prefix);
        continue;
      }
      if (byte === ESC_BYTE) {
        // user backed out of command mode; swallow silently
        continue;
      }
      switch (byte) {
        case CMD_SHARE:
          this.onCommand("share");
          break;
        case CMD_UNSHARE:
          this.onCommand("unshare");
          break;
        case CMD_STATUS_Q:
          this.onCommand("status");
          break;
        case CMD_DETACH:
          this.onCommand("detach");
          break;
        default:
          // Unknown command after prefix: forward BOTH the prefix and the
          // following byte. We never silently eat user input — anything we
          // don't claim must reach the shell.
          out += String.fromCharCode(this.prefix);
          out += ch;
          break;
      }
    }
    return out;
  }

  /** External callers may want to flip back to idle (e.g. on detach). */
  reset(): void {
    this.disarm();
  }

  /** Whether the next keystroke will be interpreted as a wrapper command. */
  get armed(): boolean {
    return this.state === "armed";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // internals
  // ──────────────────────────────────────────────────────────────────────────

  private arm(): void {
    if (this.state === "armed") return;
    this.state = "armed";
    this.onArmedChange(true);
    if (this.timeoutMs > 0) {
      this.armedTimer = setTimeout(() => {
        // Time elapsed without a follow-up keystroke. Re-emit the prefix byte
        // to the shell so it isn't lost — the user clearly didn't intend it as
        // a wrapper command. `process()` already returned, so we forward it
        // out-of-band via the onForward hook (host writes it to the PTY;
        // viewer sends it as input). This upholds the "never drop input"
        // invariant even across the armed timeout.
        if (this.state !== "armed") return;
        this.disarm();
        this.onForward(String.fromCharCode(this.prefix));
      }, this.timeoutMs);
      // Don't keep the event loop alive just for this timer.
      this.armedTimer.unref?.();
    }
  }

  private disarm(): void {
    if (this.state === "idle" && !this.armedTimer) return;
    this.state = "idle";
    if (this.armedTimer) {
      clearTimeout(this.armedTimer);
      this.armedTimer = null;
    }
    this.onArmedChange(false);
  }
}
