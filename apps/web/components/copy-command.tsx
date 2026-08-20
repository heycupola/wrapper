"use client";

import { useEffect, useRef, useState } from "react";

export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={copied ? "copyCommand isCopied" : "copyCommand"}
      onClick={() => void copy()}
      aria-label={label ?? "Copy command"}
    >
      <span className="copyCommandPrompt">$</span>
      <code className="copyCommandText">{command}</code>
      <span className="copyCommandHint" aria-live="polite">
        {copied ? "copied" : "copy"}
      </span>
      <svg className="copyCommandIcon" viewBox="0 0 16 16" aria-hidden="true">
        {copied ? (
          <path d="m3.2 8.1 3 3.1 6.6-6.7" />
        ) : (
          <>
            <rect x="5.25" y="2.25" width="8.5" height="8.5" rx="1.5" />
            <path d="M10.75 11.5v.25a2 2 0 0 1-2 2h-4.5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h.25" />
          </>
        )}
      </svg>
    </button>
  );
}
