"use client";

import { useState } from "react";

export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="copyCommand"
      onClick={() => void copy()}
      aria-label={label ?? "Copy command"}
    >
      <span className="copyCommandPrompt">$</span>
      <code className="copyCommandText">{command}</code>
      <span className="copyCommandHint">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
