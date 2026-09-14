export type FaqItem = {
  id: string;
  question: string;
  /** Plain text. Blank lines split paragraphs; backticks mark inline code. */
  answer: string;
  link?: { href: string; label: string; external?: boolean };
};

/**
 * The landing FAQ. Short answers that fit next to the release-notes card; the
 * docs carry the long form. Keep each answer to two lines at 560px (about 180
 * characters) so any item can be open without the scene overflowing on a
 * 720px-tall viewport.
 */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "output-path",
    question: "Does my terminal output go through your servers?",
    answer:
      "Not until you share. Unshared hosts listen on loopback and send no bytes and no session metadata. A share uses WebRTC when it can, else an authenticated relay that keeps nothing.",
    link: { href: "/privacy-policy", label: "How terminal data moves" },
  },
  {
    id: "shell-hook",
    question: "Does Wrapper change my shell config?",
    answer:
      "No. `wrapper share` wraps one session. `wrapper install` is optional if you want every new terminal wrapped. Remove it with `wrapper uninstall`.",
    link: {
      href: "https://docs.wrapper.sh/guides/installation",
      label: "Installation",
      external: true,
    },
  },
  {
    id: "guest-typing",
    question: "Can someone else type?",
    answer:
      "Not unless you allow it. Watching is the default. Remote access stays off until you share (`wrapper share` or `Ctrl+\\` then `s`).",
  },
  {
    id: "any-tool",
    question: "Is this just for Claude Code?",
    answer:
      "No. Anything in your terminal. Claude, Codex, vim, a build, a server. The tool does not matter.",
  },
  {
    id: "free-vs-pro",
    question: "What exactly is free?",
    answer:
      "Everything on one machine. Does not patch your shell config. Pro is $99/year ($8.25/month) or $15/month: another device, a Linux host, and the iOS viewer.",
    link: { href: "/#pricing", label: "Compare the plans" },
  },
  {
    id: "ios-when",
    question: "When is the iOS app on the App Store?",
    answer:
      "The viewer is in TestFlight beta now and App Store review is the next step. Leave an address on the right and you get one email when it lands.",
  },
  {
    id: "needs-you",
    question: "Will my phone ping me?",
    answer:
      "Yes, when the terminal needs you. The alert names the session. It does not include what is on screen.",
  },
];

/** Strip the inline-code markers for structured data and previews. */
export function plainAnswer(answer: string): string {
  return answer.replace(/`/g, "");
}
