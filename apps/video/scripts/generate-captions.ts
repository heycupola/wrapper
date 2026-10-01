/* Writes out/wrapper-launch.en.srt: the full narration as closed captions. Run: bun run captions */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STORY, VOICE_START } from "../src/story";
import { VOICE_TIMING } from "../src/voice.generated";

const MAX_CHARS = 42;
const TAIL = 0.35;

if (!VOICE_TIMING) {
  console.error("No narration timing yet. Run `bun run voice` first.");
  process.exit(1);
}

type Cue = { start: number; end: number; text: string };

function stamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/* Word index ranges: split at clause punctuation, then halve anything still too long. */
function chunks(tokens: string[]): [number, number][] {
  const clauses: [number, number][] = [];
  let from = 0;
  tokens.forEach((token, i) => {
    if (/[.,]$/.test(token) || i === tokens.length - 1) {
      clauses.push([from, i + 1]);
      from = i + 1;
    }
  });
  const length = ([a, b]: [number, number]) => tokens.slice(a, b).join(" ").length;
  const split = (range: [number, number]): [number, number][] => {
    if (length(range) <= MAX_CHARS || range[1] - range[0] < 2) return [range];
    let best = range[0] + 1;
    for (let i = range[0] + 1; i < range[1]; i++) {
      const diff = Math.abs(length([range[0], i]) - length([i, range[1]]));
      const bestDiff = Math.abs(length([range[0], best]) - length([best, range[1]]));
      if (diff < bestDiff) best = i;
    }
    return [...split([range[0], best]), ...split([best, range[1]])];
  };
  const merged: [number, number][] = [];
  for (const range of clauses.flatMap(split)) {
    const last = merged[merged.length - 1];
    if (last && length(last) < 16 && length([last[0], range[1]]) <= MAX_CHARS) last[1] = range[1];
    else merged.push([...range]);
  }
  return merged;
}

const cues: Cue[] = [];
STORY.forEach(({ text }, i) => {
  const timing = VOICE_TIMING?.sentences[i];
  if (!timing) return;
  const tokens = text.split(" ");
  const ranges = chunks(tokens);
  ranges.forEach(([a, b], k) => {
    const next = ranges[k + 1];
    cues.push({
      start: timing.words[a]?.start ?? timing.start,
      end: next ? (timing.words[next[0]]?.start ?? timing.end) : timing.end + TAIL,
      text: tokens.slice(a, b).join(" "),
    });
  });
});

const srt = cues
  .map(
    (cue, i) =>
      `${i + 1}\n${stamp(VOICE_START + cue.start)} --> ${stamp(VOICE_START + cue.end)}\n${cue.text}\n`,
  )
  .join("\n");

const outDir = join(import.meta.dir, "../out");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "wrapper-launch.en.srt"), srt);
console.log(`wrapper-launch.en.srt · ${cues.length} captions`);
