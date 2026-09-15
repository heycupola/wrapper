import type { ReactNode } from "react";
import { Keys } from "../components/keys";

export type PlanFeature = {
  label: string;
  /** Substring of `label` that gets a hover definition. */
  term?: string;
  definition?: ReactNode;
};

export const FREE_PLAN_FEATURES: readonly PlanFeature[] = [
  {
    label: "Does not patch your shell config",
    term: "shell config",
    definition:
      "Your .zshrc, .bashrc, or fish config. Wrapper does not add a line unless you run wrapper install.",
  },
  {
    label: "Attach from the same computer",
    term: "Attach",
    definition:
      "Open this live session from another terminal on this machine. Traffic stays on loopback.",
  },
  {
    label: "Nothing leaves until you share",
    term: "share",
    definition: (
      <>
        <code>wrapper share</code>, or <Keys caps={"⌃ \\"} label="Control-backslash" /> then{" "}
        <Keys caps="s" />. Until then Wrapper sends no bytes and no session metadata.
      </>
    ),
  },
];

export const PRO_PLAN_FEATURES: readonly PlanFeature[] = [
  { label: "Everything in Free" },
  {
    label: "Attach from another device",
    term: "another device",
    definition:
      "Phone, iPad, or another computer. The viewer does not need SSH or a Wrapper install.",
  },
  {
    label: "Share a session, revoke anytime",
    term: "revoke",
    definition: (
      <>
        <Keys caps={"⌃ \\"} label="Control-backslash" /> then <Keys caps="u" />. Remote viewers
        disconnect. The local shell keeps running.
      </>
    ),
  },
  {
    label: "Host on a remote Linux box",
    term: "Linux box",
    definition:
      "A VPS, a cloud devbox, or any always-on Linux host. Your laptop does not have to run Wrapper.",
  },
  {
    label: "People you invite can watch without typing",
    term: "watch without typing",
    definition: (
      <>
        They see the screen. They cannot type unless you allow it with{" "}
        <Keys caps={"⌃ \\"} label="Control-backslash" /> then <Keys caps="w" />.
      </>
    ),
  },
];
