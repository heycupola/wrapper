"use client";

import { useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "failed";

const HINT: Record<CopyStatus, string> = {
  idle: "copy",
  copied: "copied",
  failed: "select & copy",
};

const RESET_MS = 3000;

/**
 * A one-line command that copies itself. Feedback goes three ways: the hint
 * inside the button changes, a hidden status region tells screen readers, and
 * if the clipboard is unavailable the command text is selected so a manual
 * copy is one keystroke away instead of a silent failure.
 */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const codeRef = useRef<HTMLElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = label ?? "Copy command";

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  function settle(next: CopyStatus) {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (next === "copied") resetTimer.current = setTimeout(() => setStatus("idle"), RESET_MS);
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      settle("copied");
    } catch {
      settle("failed");
      const code = codeRef.current;
      const selection = window.getSelection();
      if (code && selection) {
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  const announcement =
    status === "copied"
      ? `Copied: ${command}`
      : status === "failed"
        ? "Clipboard unavailable. The command is selected; copy it with your keyboard."
        : "";

  return (
    <>
      <button
        type="button"
        className={`copyCommand ${status === "copied" ? "isCopied" : ""} ${status === "failed" ? "isFailed" : ""}`}
        onClick={() => void copy()}
        aria-label={name}
      >
        <span className="copyCommandPrompt" aria-hidden="true">
          $
        </span>
        <code className="copyCommandText" ref={codeRef}>
          {command}
        </code>
        <span className="copyCommandHint" aria-hidden="true">
          {HINT[status]}
        </span>
        <svg className="copyCommandIcon" viewBox="0 0 16 16" aria-hidden="true">
          {status === "copied" ? (
            <path d="m3.2 8.1 3 3.1 6.6-6.7" />
          ) : (
            <>
              <rect x="5.25" y="2.25" width="8.5" height="8.5" rx="1.5" />
              <path d="M10.75 11.5v.25a2 2 0 0 1-2 2h-4.5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h.25" />
            </>
          )}
        </svg>
      </button>
      <output className="visuallyHidden">{announcement}</output>
    </>
  );
}
