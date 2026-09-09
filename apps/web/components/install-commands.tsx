"use client";

import { useId, useState } from "react";
import { CopyCommand } from "./copy-command";
import { Segmented, segmentedPanelId, segmentedTabId } from "./ui/segmented";

type InstallMethod = "curl" | "brew";

/* Labels are the commands themselves: the reader sees the word they will
   type. curl comes first because it works on every Mac and Linux box. */
const METHODS: readonly {
  value: InstallMethod;
  label: string;
  command: string;
  copyLabel: string;
}[] = [
  {
    value: "curl",
    label: "curl",
    command: "curl -fsSL https://wrapper.sh/install | bash",
    copyLabel: "Copy curl install command",
  },
  {
    value: "brew",
    label: "brew",
    command: "brew install heycupola/tap/wrapper",
    copyLabel: "Copy Homebrew install command",
  },
];

const OPTIONS = METHODS.map(({ value, label }) => ({ value, label }));

/**
 * The host install command with a switch between curl and brew, used where
 * the reader has already decided to install (onboarding). Only one command is
 * meant to run, so only one is shown; the switch makes the choice explicit
 * instead of asking the reader to skip a line.
 */
export function InstallCommands({ className }: { className?: string }) {
  const [method, setMethod] = useState<InstallMethod>("curl");
  const baseId = useId();
  const active = METHODS.find((entry) => entry.value === method) ?? METHODS[0]!;

  return (
    <div className={["installCommands", className].filter(Boolean).join(" ")}>
      <Segmented
        id={baseId}
        size="sm"
        aria-label="Install method"
        options={OPTIONS}
        value={method}
        onChange={setMethod}
      />
      <div
        role="tabpanel"
        id={segmentedPanelId(baseId, active.value)}
        aria-labelledby={segmentedTabId(baseId, active.value)}
        className="installCommandsPanel"
      >
        <CopyCommand key={active.value} command={active.command} label={active.copyLabel} />
      </div>
    </div>
  );
}
