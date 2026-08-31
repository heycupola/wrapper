/**
 * User-facing feedback channels for the wrapped shell.
 *
 * The wrapped session has to relay status changes (armed, shared,
 * unshared, …) to a user who may be deep inside a fullscreen TUI
 * like vim or claude-code. We can't reliably draw on the screen
 * without fighting whatever app currently owns it, so feedback flows
 * through three channels, each with different trade-offs:
 *
 *   1. **Window title** (OSC 0). TUIs traditionally do not touch the
 *      window title. Writing here is non-disruptive everywhere — it
 *      shows up at the top of the terminal window, on the system
 *      taskbar, and in tmux/screen status lines that mirror the
 *      title. We use this for persistent state (`armed`, `shared`).
 *
 *   2. **Inline one-liner** to stdout. Only safe when the inner
 *      shell is idle (no foreground job): the shell's prompt redraw
 *      hook (zsh `precmd` / bash `PROMPT_COMMAND` / starship's
 *      built-in refresh) repaints over our line cleanly. Inside a
 *      TUI we never write here.
 *
 *   3. **OS notification** (macOS NotificationCenter / Linux
 *      libnotify). Fire-and-forget background process; the user
 *      sees the change in their notification tray no matter which
 *      window has focus. Falls back to the terminal bell when no
 *      notifier is available.
 *
 * Every helper here is intentionally synchronous-ish: spawn happens
 * in the background, no awaits, no failures bubble up. Feedback that
 * crashes the host process is worse than no feedback.
 */

import pc from "picocolors";
import { env } from "./env";

const ESC = "\x1b";
const BEL = "\x07";

export type SessionHudRole = "host" | "viewer";
export type SessionTransportStatus = "local" | "connecting" | "relay" | "p2p" | "offline";

export interface SessionHudState {
  role: SessionHudRole;
  sessionTag: string;
  transport: SessionTransportStatus;
  armed?: boolean;
  p2pPeerCount?: number;
}

/**
 * Build the persistent window title and the context-aware prefix menu.
 *
 * We deliberately use the terminal title instead of reserving a bottom row.
 * Wrapper passes PTY output through unchanged, so a fixed in-terminal status
 * line would fight alternate-screen apps such as vim, less, htop, and tmux.
 */
export function formatSessionHud(state: SessionHudState): string {
  const transport =
    state.transport === "p2p" && state.role === "host" && (state.p2pPeerCount ?? 0) > 0
      ? `p2p x${state.p2pPeerCount}`
      : state.transport;
  const identity = `${state.role} • ${state.sessionTag} • ${transport}`;
  if (!state.armed) return `wrapper • ${identity}`;
  const commands = state.role === "host" ? "s share • u unshare • ? status" : "d detach • ? status";
  return `● ${identity} | ${commands}`;
}

/** One-time discoverability hint printed before the terminal becomes busy. */
export function formatControlsHint(role: SessionHudRole, prefixLabel = "Ctrl+\\"): string {
  return role === "host"
    ? `controls: ${prefixLabel} then s share | u unshare | ? status`
    : `controls: ${prefixLabel} then d detach | ? status`;
}

/**
 * Set the host terminal's window title via OSC 0. Strips control
 * characters so a malicious or buggy state value can't smuggle a
 * title-terminator (BEL or ST) into the middle of the sequence.
 */
export function setTitle(text: string): void {
  if (!process.stdout.isTTY) return;
  const safe = sanitizeTitle(text);
  process.stdout.write(`${ESC}]0;${safe}${BEL}`);
}

/**
 * Reset the title to empty. The user's shell prompt will rewrite it
 * within one keystroke (PROMPT_COMMAND, precmd, starship, …), which
 * is the cleanest "clear our overlay" we can do without snapshotting
 * the previous title.
 */
export function clearTitle(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`${ESC}]0;${BEL}`);
}

/**
 * Write a single CRLF-bracketed line to stdout. Caller MUST verify
 * the inner shell is idle before invoking this (see `PtySession.isIdle`).
 *
 * The leading `\r\n` ensures we never overwrite the cursor's current
 * line — we drop down to a fresh row, paint the message, then drop
 * one more time so the next prompt redraw lands on its own line.
 */
export function inlineMessage(text: string): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`\r\n${pc.cyan("[wrapper]")} ${text}\r\n`);
}

/**
 * Show a desktop notification. macOS uses `osascript`, Linux uses
 * `notify-send`. Anything else (or a missing binary) silently falls
 * through to a terminal bell so at least *some* feedback fires.
 */
export function notifyOS(title: string, body: string): void {
  const safeTitle = sanitizeNotification(title);
  const safeBody = sanitizeNotification(body);
  try {
    if (process.platform === "darwin") {
      Bun.spawn(
        ["osascript", "-e", `display notification "${safeBody}" with title "${safeTitle}"`],
        { stdio: ["ignore", "ignore", "ignore"] },
      );
      return;
    }
    if (process.platform === "linux") {
      Bun.spawn(["notify-send", safeTitle, safeBody], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      return;
    }
  } catch {
    // Notifier missing or sandboxed; fall through to bell.
  }
  bell();
}

/** Ring the terminal bell. Always works, never disruptive. */
export function bell(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(BEL);
}

// ──────────────────────────────────────────────────────────────────────────
// internals
// ──────────────────────────────────────────────────────────────────────────

/**
 * Strip every byte that could prematurely terminate the OSC sequence
 * (BEL / ESC / control chars). We also clamp the title to 120 chars
 * because some terminals truncate at 256 and we want to leave room
 * for the namespace tag, dev/prod marker, etc.
 */
function sanitizeTitle(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
    if (out.length >= 120) break;
  }
  return env.isDev ? `[${env.label}] ${out}` : out;
}

/**
 * AppleScript and notify-send both choke on raw double quotes inside
 * the message. Stripping is safer than escaping — our strings are
 * short and never include URL/HTML payloads, so we can drop the few
 * characters that would otherwise need shell-style quoting.
 */
function sanitizeNotification(text: string): string {
  return text
    .replace(/["\\]/g, "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
}
