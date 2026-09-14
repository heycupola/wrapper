/**
 * Detect a real terminal bell in PTY output without treating OSC title
 * terminators as a doorbell. Window titles are `ESC ] … BEL` (or ST).
 */

const ESC = 0x1b;
const BEL = 0x07;
const OSC = 0x5d;
const ST = 0x5c;

export type DoorbellParser = {
  phase: "ground" | "esc" | "osc" | "oscEsc";
};

export function createDoorbellParser(): DoorbellParser {
  return { phase: "ground" };
}

/** True when `chunk` contains a BEL that is not an OSC/ST terminator. */
export function scanDoorbell(chunk: string, parser: DoorbellParser): boolean {
  let found = false;
  for (let i = 0; i < chunk.length; i++) {
    const code = chunk.charCodeAt(i);
    switch (parser.phase) {
      case "ground":
        if (code === ESC) parser.phase = "esc";
        else if (code === BEL) found = true;
        break;
      case "esc":
        if (code === OSC) parser.phase = "osc";
        else if (code === ESC) parser.phase = "esc";
        else if (code === BEL) {
          found = true;
          parser.phase = "ground";
        } else {
          parser.phase = "ground";
        }
        break;
      case "osc":
        if (code === BEL) parser.phase = "ground";
        else if (code === ESC) parser.phase = "oscEsc";
        break;
      case "oscEsc":
        if (code === ST || code === BEL) parser.phase = "ground";
        else if (code === OSC) parser.phase = "osc";
        else parser.phase = "osc";
        break;
    }
  }
  return found;
}
