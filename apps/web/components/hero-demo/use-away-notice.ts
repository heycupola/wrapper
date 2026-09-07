"use client";

import { type RefObject, useEffect, useState } from "react";

/** Shorter absences read as a glance at another window, not as leaving. */
export const MIN_AWAY_MS = 5000;
/** How long the note stays before the guide takes its place back. */
export const AWAY_NOTICE_MS = 5000;

export interface AwayNotice {
  id: number;
  awayMs: number;
}

/**
 * "Your terminal, still running" is the claim; this is the small proof. When
 * the visitor leaves the tab and comes back to a stage that is still on
 * screen, the guide gets one note saying how long they were gone and that the
 * session is exactly where they left it. Nothing is simulated to make the
 * point: the shell never stopped, so there is nothing to catch up on.
 */
export function useAwayNotice(stageRef: RefObject<HTMLElement | null>): AwayNotice | null {
  const [notice, setNotice] = useState<AwayNotice | null>(null);

  useEffect(() => {
    let hiddenAt: number | null = null;
    let counter = 0;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null) return;
      const awayMs = Date.now() - hiddenAt;
      hiddenAt = null;
      if (awayMs < MIN_AWAY_MS) return;
      if (!onScreen(stageRef.current)) return;
      counter += 1;
      setNotice({ id: counter, awayMs });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stageRef]);

  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => setNotice(null), AWAY_NOTICE_MS);
    return () => window.clearTimeout(handle);
  }, [notice]);

  return notice;
}

function onScreen(node: HTMLElement | null): boolean {
  if (!node) return false;
  const rect = node.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

/** `42s`, `3m 12s`, `1h 04m`: the way a person would say it, not a clock. */
export function formatAway(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}
