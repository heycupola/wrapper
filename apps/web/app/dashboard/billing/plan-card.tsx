"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type PlanCardProps = {
  name: string;
  label: string;
  price: string;
  period: string;
  summary: string;
  features: readonly string[];
  highlighted?: boolean;
  children?: ReactNode;
};

/* A plan is one short row: name and price on the first line, a one-sentence
   summary under it, and a "What's included" trigger that reveals the full
   list in a tooltip on hover or focus. The trigger is also a real toggle so
   touch and keyboard users can pin it open; Escape and clicking away close
   it. */
export function PlanCard({
  name,
  label,
  price,
  period,
  summary,
  features,
  highlighted = false,
  children,
}: PlanCardProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listId = `${baseId}-features`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setPinned(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  return (
    <article
      className={`dashboardPanel dashboardPlanCard${highlighted ? " dashboardProPanel" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="dashboardPlanHead">
        <div className="dashboardPlanName">
          <span className="dashboardPanelLabel">{label}</span>
          <h2 id={titleId}>{name}</h2>
        </div>
        <p className="dashboardPlanPrice">
          <strong>{price}</strong>
          <span>{period}</span>
        </p>
      </div>
      <p className="dashboardPriceLead">{summary}</p>
      <div className="dashboardPlanFoot">
        <div ref={wrapRef} className="dashboardPlanInfo" data-pinned={pinned ? "" : undefined}>
          <button
            type="button"
            className="dashboardPlanInfoButton"
            aria-describedby={listId}
            aria-expanded={pinned}
            onClick={() => setPinned((value) => !value)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.6" />
              <path d="M8 7v4.2M8 4.6v.2" />
            </svg>
            What&apos;s included
          </button>
          <div id={listId} role="tooltip" className="dashboardPlanTooltip">
            <ul>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}
