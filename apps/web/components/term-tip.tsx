"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HIDE_MS = 180;
const VIEWPORT_PAD = 12;

export function TermTip({ children, definition }: { children: ReactNode; definition: string }) {
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLParagraphElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; maxWidth: number } | null>(
    null,
  );
  const visible = pinned || hovered;

  const cancelHide = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxWidth = Math.min(300, window.innerWidth - VIEWPORT_PAD * 2);
    let left = rect.left;
    if (left + maxWidth > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, window.innerWidth - maxWidth - VIEWPORT_PAD);
    }
    const below = rect.bottom + 8;
    const estimatedHeight = 88;
    const top =
      below + estimatedHeight > window.innerHeight - VIEWPORT_PAD
        ? Math.max(VIEWPORT_PAD, rect.top - estimatedHeight - 8)
        : below;
    setCoords({ top, left, maxWidth });
  }, []);

  const show = useCallback(() => {
    cancelHide();
    measure();
    setHovered(true);
  }, [cancelHide, measure]);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setHovered(false), HIDE_MS);
  }, [cancelHide]);

  useEffect(() => {
    if (!visible) return;
    function onMove() {
      measure();
    }
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("wheel", onMove, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("wheel", onMove, true);
    };
  }, [visible, measure]);

  useEffect(() => {
    if (!visible) return;
    const bubble = bubbleRef.current;
    if (!bubble) return;
    function enter() {
      cancelHide();
      setHovered(true);
    }
    function leave() {
      scheduleHide();
    }
    bubble.addEventListener("mouseenter", enter);
    bubble.addEventListener("mouseleave", leave);
    return () => {
      bubble.removeEventListener("mouseenter", enter);
      bubble.removeEventListener("mouseleave", leave);
    };
  }, [visible, coords, cancelHide, scheduleHide]);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setPinned(false);
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

  useEffect(() => () => cancelHide(), [cancelHide]);

  return (
    <span ref={wrapRef} className="termTip" data-pinned={pinned ? "" : undefined}>
      <button
        type="button"
        className="termTipButton"
        aria-describedby={visible ? tooltipId : undefined}
        aria-expanded={pinned}
        onClick={() => {
          measure();
          setPinned((value) => !value);
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
      >
        {children}
      </button>
      {visible && coords
        ? createPortal(
            <p
              ref={bubbleRef}
              id={tooltipId}
              role="tooltip"
              className="termTipBubble"
              data-visible=""
              style={{ top: coords.top, left: coords.left, maxWidth: coords.maxWidth }}
            >
              {definition}
            </p>,
            document.body,
          )
        : null}
    </span>
  );
}
