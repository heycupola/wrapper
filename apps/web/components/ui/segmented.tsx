"use client";

import { type KeyboardEvent, type ReactNode, useId } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech; the visible label usually sits nearby. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Prefix for the tab and panel ids; pair it with `segmentedPanelId`. */
  id?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * A pill track with one raised option: two to four peers where exactly one
 * is in effect, such as install methods or a billing period. It uses tab
 * semantics so the region it drives can be a `tabpanel`; the arrow keys move
 * the selection, Home and End jump to the ends. Styling lives in
 * `app/controls.css`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  id,
  size = "md",
  className,
  ...labelling
}: SegmentedProps<T>) {
  const generated = useId();
  const baseId = id ?? generated;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = options.findIndex((option) => option.value === value);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    document.getElementById(segmentedTabId(baseId, option.value))?.focus();
  }

  return (
    <div
      role="tablist"
      className={["segmented", className].filter(Boolean).join(" ")}
      data-size={size === "md" ? undefined : size}
      {...labelling}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={segmentedTabId(baseId, option.value)}
            aria-selected={selected}
            aria-controls={segmentedPanelId(baseId, option.value)}
            tabIndex={selected ? 0 : -1}
            className="segmentedOption"
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function segmentedTabId(baseId: string, value: string): string {
  return `${baseId}-tab-${value}`;
}

export function segmentedPanelId(baseId: string, value: string): string {
  return `${baseId}-panel-${value}`;
}
