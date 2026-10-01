/* Film timeline in seconds, cut to the narration. Shared by the visuals and the audio scripts. */
import { STORY, VOICE_START, type StoryTiming } from "./story";
import { VOICE_TIMING } from "./voice.generated";

export const FPS = 60;
export const BEAT_SECONDS = 0.6;

export const SESSION_TAG = "k2f9a1";

/* Before the take is recorded, pace the story at a calm reading speed. */
function estimateTiming(): StoryTiming {
  let clock = 0;
  const sentences = STORY.map(({ text, pause }) => {
    const start = clock;
    const words = [...text.matchAll(/[A-Za-z']+/g)].map((match, i) => ({
      word: match[0].toLowerCase(),
      start: start + i * 0.36,
    }));
    const end = start + words.length * 0.36;
    clock = end + pause + 0.2;
    return { start, end, words };
  });
  return { duration: clock, sentences };
}

export const STORY_TIMING: StoryTiming = VOICE_TIMING ?? estimateTiming();

/* When sentence `index` starts, in film time. */
function said(index: number): number {
  return VOICE_START + (STORY_TIMING.sentences[index]?.start ?? 0);
}

/* When `word` is spoken inside sentence `index`, in film time. */
function word(index: number, target: string): number {
  const sentence = STORY_TIMING.sentences[index];
  const hit = sentence?.words.find((w) => w.word === target);
  if (!hit) throw new Error(`"${target}" is not in sentence ${index}`);
  return VOICE_START + hit.start;
}

const typeStart = said(1) + 0.05;
const typeCharSeconds = 0.055;
const enter = typeStart + 13 * typeCharSeconds + 0.12;
const pullOut = enter + 0.05;
const pullOutSeconds = 1.3;
const output = pullOut + 0.5;
const split = Math.max(pullOut + 1.1, word(1, "right") - 0.4);
const linkDraw = split + 0.5;
const live = Math.max(word(1, "phone"), linkDraw + 0.6);

const guestPress = word(3, "type");
const guestTyping = guestPress + 0.55;
const phoneCharSeconds = 0.075;
const guestDone = guestTyping + 10 * phoneCharSeconds + 0.2;

const attention = Math.max(said(4), guestDone + 0.5);
const notify = Math.max(word(4, "phone") - 0.2, attention + 0.8);
const unshareKey = said(5) - 0.3;
const unsharePress = word(5, "ends");
const attentionTap = Math.min(notify + 1.0, unshareKey - 0.6);

export const T = {
  typeStart,
  typeCharSeconds,
  enter,
  pullOut,
  pullOutSeconds,
  output,
  yourTerminal: Math.max(word(1, "same") - 0.1, output + 0.3),
  split,
  linkDraw,
  onYourPhone: Math.max(word(1, "phone") - 0.25, split + 0.5),
  live,
  direct: said(2),
  relay: word(2, "through") - 0.2,
  relayBack: said(3) - 0.6,
  guestKey: said(3),
  guestPress,
  guestTyping,
  phoneCharSeconds,
  attention,
  notify,
  attentionTap,
  /* The camera leaves the phone as the reply is typed, so it has settled before the next line. */
  closeUpEnd: attentionTap + 0.1,
  unshareKey,
  unsharePress,
  unshare: unsharePress + 0.1,
  nothingLeaves: word(5, "nothing") - 0.1,
  regroup: said(6) - 0.4,
  worksWith: said(6),
  runWords: said(6) + 0.7,
  runWordSeconds: BEAT_SECONDS,
  noPatch: word(6, "never") - 0.15,
  outro: said(7) - 1.1,
  mark: said(7) - 0.5,
  wordmark: said(7),
  url: said(7) + 0.6,
  handoff: said(7) + 1.8,
  cupola: said(7) + 2.15,
} as const;

/* The end card holds long enough for the hand-off to Cupola to register. */
export const DURATION_SECONDS = Math.ceil((VOICE_START + STORY_TIMING.duration + 4.0) * 2) / 2;

export const PREFIX_LEAD = 0.38;

export type Tone = "ink" | "strong" | "muted" | "faint";
export type Part = { text: string; tone: Tone };

export type ScriptLine = {
  at: number;
  parts?: Part[];
  prompt?: boolean;
  typed?: { text: string; at: number; rate: number; by: "host" | "phone" };
};

const ink = (text: string): Part => ({ text, tone: "ink" });
const strong = (text: string): Part => ({ text, tone: "strong" });
const muted = (text: string): Part => ({ text, tone: "muted" });
const faint = (text: string): Part => ({ text, tone: "faint" });

export function typedEnd(line: ScriptLine): number {
  if (!line.typed) return line.at;
  return line.typed.at + line.typed.text.length * line.typed.rate;
}

const gitStatus: ScriptLine = {
  at: T.output + 0.5,
  prompt: true,
  typed: { text: "git status", at: T.guestTyping, rate: T.phoneCharSeconds, by: "phone" },
};
const gitDone = typedEnd(gitStatus) + 0.2;

const claude: ScriptLine = {
  at: gitDone + 0.35,
  prompt: true,
  typed: { text: "claude", at: T.attention, rate: 0.05, by: "host" },
};

/* Terminal lines in screen order. A line with a later `at` inserts above the prompt. */
export const SCRIPT: ScriptLine[] = [
  {
    at: 0,
    prompt: true,
    typed: { text: "wrapper share", at: T.typeStart, rate: T.typeCharSeconds, by: "host" },
  },
  { at: T.output, parts: [faint("session shared via relay")] },
  { at: T.output + 0.1, parts: [muted("share code "), strong("K7QM-4XPR")] },
  {
    at: T.output + 0.2,
    parts: [muted("join "), ink(`wrapper attach --relay --id ${SESSION_TAG}`)],
  },
  { at: T.output + 0.3, parts: [faint("guests watch only · Ctrl+\\ then w to allow typing")] },
  { at: T.guestPress + 0.15, parts: [faint("people you invite can type")] },
  gitStatus,
  { at: gitDone, parts: [ink("On branch main")] },
  { at: gitDone + 0.1, parts: [muted("nothing to commit, working tree clean")] },
  claude,
  {
    at: typedEnd(claude) + 0.35,
    parts: [muted("● "), ink("Allow edit to src/app.ts? "), faint("(y/n) ")],
    typed: { text: "y", at: T.attentionTap + 0.25, rate: 0.05, by: "phone" },
  },
  { at: T.unshare + 0.2, parts: [faint("session unshared")] },
  { at: T.unshare + 0.35, prompt: true },
];

export const RUN_WORDS = ["claude", "codex", "vim", "htop"] as const;

/*
 * On-screen headlines: the short version of what the narrator is saying. `closeUp` headlines take the
 * close-up layout, where "\n" marks their line break.
 */
export type Headline = { text: string; start: number; end: number; closeUp?: boolean };

export const HEADLINES: Headline[] = [
  { text: "Your terminal. On your phone.", start: T.yourTerminal, end: T.direct - 0.35 },
  { text: "Direct when possible.", start: T.direct, end: T.relay - 0.15 },
  { text: "Relayed when not.", start: T.relay + 0.15, end: T.guestKey - 0.35 },
  { text: "Others watch. You decide who types.", start: T.guestKey, end: T.attention - 0.35 },
  {
    text: "Know when\nit needs you.",
    start: T.attention + 0.6,
    end: T.closeUpEnd - 0.05,
    closeUp: true,
  },
  { text: "Only when you share.", start: T.closeUpEnd + 0.85, end: T.nothingLeaves - 0.3 },
  { text: "Nothing leaves until you say so.", start: T.nothingLeaves, end: T.regroup - 0.2 },
  { text: "Works with whatever is already running.", start: T.worksWith, end: T.noPatch - 0.3 },
  { text: "Does not patch your shell config.", start: T.noPatch, end: T.outro - 0.2 },
];

/* When the narrator is speaking, in film time. The music ducks under these. */
export const VOICE_SPANS = STORY_TIMING.sentences.map((s) => ({
  start: VOICE_START + s.start,
  end: VOICE_START + s.end,
}));

export { VOICE_START };
