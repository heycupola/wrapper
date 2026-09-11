export type FaqItem = {
  id: string;
  question: string;
  /** Plain text. Blank lines split paragraphs; backticks mark inline code. */
  answer: string;
  link?: { href: string; label: string; external?: boolean };
};

/**
 * The landing FAQ. Six short answers that fit one screen next to the
 * release-notes card; the docs carry the long form. Keep each answer to two
 * lines at 560px (about 180 characters) so any item can be open without the
 * scene overflowing on a 720px-tall viewport.
 */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "output-path",
    question: "Does my terminal output go through your servers?",
    answer:
      "On this machine, no: the host listens on loopback and sends nothing anywhere. A share goes directly over WebRTC when it can, else through an authenticated relay that keeps nothing.",
    link: { href: "/privacy-policy", label: "How terminal data moves" },
  },
  {
    id: "uninvited-viewer",
    question: "Can someone attach without me noticing?",
    answer:
      "No. Remote access stays off until you press `Ctrl+\\` then `s`, and a guest needs the code it prints. Tickets are single-use and expire in 60 seconds; `Ctrl+\\` then `u` ends the share.",
  },
  {
    id: "prefix-key",
    question: "Ctrl+\\ normally sends SIGQUIT. Does Wrapper take it over?",
    answer:
      "It becomes a prefix, like `Ctrl+b` in tmux. Press it twice to send the literal byte; unknown combos pass through, and `Ctrl+C`, `Ctrl+Z`, `Ctrl+D` always do. `WRAPPER_PREFIX` picks another key.",
  },
  {
    id: "free-vs-pro",
    question: "What exactly is free?",
    answer:
      "Everything on one machine: wrapping zsh, bash, and fish, and attaching from the same computer. Pro covers the part that crosses networks: another device, a share code, the iOS viewer.",
    link: { href: "/#pricing", label: "Compare the plans" },
  },
  {
    id: "ios-when",
    question: "When is the iOS app on the App Store?",
    answer:
      "The viewer is in TestFlight beta now and App Store review is the next step. Leave an address on the right and you get one email when it lands.",
  },
  {
    id: "open-source",
    question: "Is Wrapper open source?",
    answer:
      "Yes. The CLI, web app, backend, and relay live in one MIT-licensed monorepo, so you can read the code that handles your bytes before installing it.",
    link: {
      href: "https://github.com/heycupola/wrapper",
      label: "Read the source",
      external: true,
    },
  },
];

/** Strip the inline-code markers for structured data and previews. */
export function plainAnswer(answer: string): string {
  return answer.replace(/`/g, "");
}
