"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Segmented, segmentedPanelId, segmentedTabId } from "./ui/segmented";

type Method = "curl" | "brew";

const COMMANDS: Record<Method, string> = {
  curl: "curl -fsSL https://wrapper.sh/install | bash",
  brew: "brew install heycupola/tap/wrapper",
};

const OPTIONS = [
  { value: "curl", label: "curl" },
  { value: "brew", label: "Homebrew" },
] as const;

const RESET_MS = 2200;

/**
 * The hero's install block, shaped like the terminal window beside it: a
 * header that picks the method and a body that holds the command. The two
 * methods split the header in equal halves, so the choice is the first thing
 * read and cannot be missed; the raised half shares the body's surface, which
 * ties the tab to the command it controls. The command line itself is the
 * button: press anywhere on it to copy.
 *
 * Copying only changes the glyph at the end of the line plus a hidden status
 * for screen readers. If the clipboard is blocked the command text is selected instead.
 */
export function InstallCta() {
  const [method, setMethod] = useState<Method>("curl");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseId = useId();
  const command = COMMANDS[method];

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pick(next: Method): void {
    if (next === method) return;
    if (timer.current) clearTimeout(timer.current);
    setCopied(false);
    setFailed(false);
    setMethod(next);
  }

  async function copy(): Promise<void> {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(command);
      setFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), RESET_MS);
    } catch {
      setCopied(false);
      setFailed(true);
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

  const announcement = copied
    ? `Copied: ${command}`
    : failed
      ? "Clipboard unavailable. The command is selected; copy it with your keyboard."
      : "";

  return (
    <div className="installCta">
      <Segmented
        id={baseId}
        className="installCtaTabs"
        options={OPTIONS}
        value={method}
        onChange={pick}
        aria-label="Install method"
      />
      <div
        role="tabpanel"
        id={segmentedPanelId(baseId, method)}
        aria-labelledby={segmentedTabId(baseId, method)}
      >
        <button
          type="button"
          className={["installCtaLine", copied ? "isCopied" : "", failed ? "isFailed" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => void copy()}
          aria-label={`Copy the ${method === "curl" ? "curl" : "Homebrew"} install command`}
        >
          <span className="installCtaPrompt" aria-hidden="true">
            $
          </span>
          <code ref={codeRef} className="installCtaCommand">
            {command}
          </code>
          <span className="installCtaHint" aria-hidden="true">
            <svg className="installCtaHintIcon" viewBox="0 0 16 16">
              {copied ? (
                <path d="m3.2 8.1 3 3.1 6.6-6.7" />
              ) : (
                <>
                  <rect x="5.25" y="2.25" width="8.5" height="8.5" rx="1.5" />
                  <path d="M10.75 11.5v.25a2 2 0 0 1-2 2h-4.5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h.25" />
                </>
              )}
            </svg>
          </span>
        </button>
      </div>
      <output className="visuallyHidden">{announcement}</output>
    </div>
  );
}
