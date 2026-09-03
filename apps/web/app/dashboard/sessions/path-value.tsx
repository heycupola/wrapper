"use client";

import { useEffect, useId, useRef, useState } from "react";

export function DashboardPathValue({ value }: { value: string }) {
  const tooltipId = useId();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`dashboardPathValue ${copied ? "isCopied" : ""}`}
        aria-label={`Copy working directory ${value}`}
        aria-describedby={tooltipId}
        onClick={() => void copy()}
      >
        <code>{value}</code>
        <span id={tooltipId} className="dashboardPathTooltip" role="tooltip">
          {copied ? "Copied" : value}
        </span>
      </button>
      <output className="visuallyHidden">{copied ? "Working directory copied" : ""}</output>
    </>
  );
}
