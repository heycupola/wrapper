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
      "Not until you share. Unshared hosts listen on loopback and send no bytes and no session metadata. A share uses WebRTC when it can, else an authenticated relay that keeps nothing.",
    link: { href: "/privacy-policy", label: "How terminal data moves" },
  },
  {
    id: "shell-hook",
    question: "Does Wrapper hook my shell?",
    answer:
      "No. `wrapper share` wraps one session. `wrapper install` is optional if you want every new terminal wrapped. Remove it with `wrapper uninstall`.",
    link: {
      href: "https://docs.wrapper.sh/guides/installation",
      label: "Installation",
      external: true,
    },
  },
  {
    id: "uninvited-viewer",
    question: "Can someone attach without me noticing?",
    answer:
      "No. Remote access stays off until you share (`wrapper share` or `Ctrl+\\` then `s`). A guest needs the code it prints. `Ctrl+\\` then `u` ends the share.",
  },
  {
    id: "free-vs-pro",
    question: "What exactly is free?",
    answer:
      "Everything on one machine, with no rc hook required. Pro is $99/year or $15/month and covers another device, a share code, and the iOS viewer.",
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
