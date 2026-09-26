/* The narration, recorded as one take. The picture is timed to these sentences. */

export const VOICE_START = 0.6;

export const STORY = [
  {
    text: "Your best work lives in a terminal. But you can't always stay at your desk.",
    pause: 0.5,
  },
  { text: "One command, and that same terminal is right there on your phone.", pause: 0.6 },
  {
    text: "It connects directly when it can, and through an encrypted relay when it can't.",
    pause: 0.5,
  },
  { text: "Invite someone to watch. They only type if you let them.", pause: 0.6 },
  { text: "And when Claude needs an answer, your phone tells you.", pause: 0.7 },
  { text: "One keystroke ends it. Nothing leaves your machine until you say so.", pause: 0.7 },
  {
    text: "It works with the tools you already use, and never touches your shell config.",
    pause: 1.1,
  },
  { text: "Wrapper.", pause: 0 },
] as const;

export type SentenceTiming = {
  start: number;
  end: number;
  words: { word: string; start: number }[];
};

export type StoryTiming = { duration: number; sentences: SentenceTiming[] };

/* The text sent to ElevenLabs, with pauses between sentences. */
export function storyText(): string {
  return STORY.map((s) => (s.pause > 0 ? `${s.text} <break time="${s.pause}s" />` : s.text)).join(
    " ",
  );
}
