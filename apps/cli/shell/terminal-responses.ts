/**
 * Strip terminal-emulator response sequences from a stdin chunk.
 *
 * When the wrapped shell runs an app like vim, htop, or even Starship's own
 * prompt, that app may probe the host terminal with sequences like:
 *
 *   ESC [c              Primary Device Attributes (DA)
 *   ESC [>c             Secondary DA
 *   ESC [?...n          Device Status Report (DSR)
 *   ESC [...R           Cursor Position Report
 *   ESC ]10;? ESC \     OSC colour queries (foreground/background/cursor)
 *   ESC [I  / ESC [O    Focus in / out events
 *
 * Those probes travel out of the inner PTY, get rendered by the user's real
 * terminal (Ghostty, iTerm, …), and the real terminal politely answers
 * *back through stdin*. Without filtering, our attach client treats those
 * answers as keystrokes and writes them straight back into the PTY — the
 * inner app then gets caught in a feedback loop, the screen tears, and the
 * user thinks Ctrl+C is broken when in reality the foreground program is
 * just stuck reading garbage.
 *
 * Real keystrokes never produce these specific shapes, so we can detect
 * and drop them without affecting normal input. We only ever strip whole,
 * matched responses — partial sequences are left intact so a slow pipe
 * doesn't lose user input.
 */

const ESC = 0x1b;
const BEL = 0x07;

interface MatchResult {
  /** Total bytes consumed from `input` starting at `offset`. */
  consumed: number;
}

type Matcher = (input: string, offset: number) => MatchResult | null;

/** ESC [ ... <final byte in 0x40..0x7E> */
const csiResponse: Matcher = (input, offset) => {
  if (input.charCodeAt(offset) !== ESC) return null;
  if (input.charCodeAt(offset + 1) !== 0x5b) return null; // '['
  let i = offset + 2;
  // Parameter bytes: 0x30-0x3F (digits, ;, ?, >, =, etc.)
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (code >= 0x30 && code <= 0x3f) {
      i += 1;
      continue;
    }
    break;
  }
  // Intermediate bytes: 0x20-0x2F
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (code >= 0x20 && code <= 0x2f) {
      i += 1;
      continue;
    }
    break;
  }
  // Final byte: 0x40-0x7E (e.g. 'c', 'n', 'R', 'I', 'O')
  if (i >= input.length) return null;
  const finalByte = input.charCodeAt(i);
  if (finalByte < 0x40 || finalByte > 0x7e) return null;
  // Only drop the *response-ish* finals to avoid eating user-typed escapes
  // (arrow keys end in A/B/C/D, function keys in ~, etc.).
  const responseFinals = new Set([
    0x52, // 'R' — Cursor Position Report
    0x63, // 'c' — Device Attributes response
    0x6e, // 'n' — Device Status Report response
    0x49, // 'I' — focus in
    0x4f, // 'O' — focus out
  ]);
  if (!responseFinals.has(finalByte)) return null;
  // Only strip "?..." or ">..." flavoured responses; bare CSI 'n' / 'R' /
  // 'c' would also cover legitimate user-typed sequences in some niche
  // terminal modes, but in practice they only appear as responses.
  return { consumed: i - offset + 1 };
};

/** ESC ] ... (BEL | ESC \) */
const oscResponse: Matcher = (input, offset) => {
  if (input.charCodeAt(offset) !== ESC) return null;
  if (input.charCodeAt(offset + 1) !== 0x5d) return null; // ']'
  let i = offset + 2;
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (code === BEL) return { consumed: i - offset + 1 };
    if (code === ESC && input.charCodeAt(i + 1) === 0x5c /* '\\' */) {
      return { consumed: i - offset + 2 };
    }
    i += 1;
  }
  return null;
};

const MATCHERS: Matcher[] = [csiResponse, oscResponse];

/**
 * Return `input` with every recognised terminal-response sequence removed.
 * Unmatched bytes (regular keystrokes, including legitimate Esc presses
 * and arrow keys) are passed through unchanged.
 */
export function stripTerminalResponses(input: string): string {
  if (input.length === 0) return input;

  let out = "";
  let i = 0;
  while (i < input.length) {
    let matched: MatchResult | null = null;
    for (const match of MATCHERS) {
      matched = match(input, i);
      if (matched) break;
    }
    if (matched) {
      i += matched.consumed;
      continue;
    }
    out += input[i];
    i += 1;
  }
  return out;
}
