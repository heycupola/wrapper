"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";

/** Window offset from its CSS position, as a percentage of the screen size. */
export type WindowOffset = { x: number; y: number };

const ORIGIN: WindowOffset = { x: 0, y: 0 };
/** Menu bar height as a fraction of the screen width (see `.macMenuBar`). */
const MENU_BAR = 0.0293;
/** Arrow-key nudge in percent of the screen; Shift multiplies it. */
const KEY_STEP = 2;
const KEY_STEP_FAST = 8;
/** Gap kept between the window and the phone that overlaps the screen, in px. */
const PHONE_GAP = 8;
/** Below this downward offset (percent) the guide has to move above the window. */
const LOW_AFTER = 10;

type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
};

const clampTo = (bounds: Bounds, xPx: number, yPx: number): WindowOffset => ({
  x: (Math.min(bounds.xMax, Math.max(bounds.xMin, xPx)) / bounds.width) * 100,
  y: (Math.min(bounds.yMax, Math.max(bounds.yMin, yPx)) / bounds.height) * 100,
});

/**
 * Lets a positioned window be dragged around its screen like on the desktop.
 * The offset is kept in percent of the screen so it survives resizes, and it
 * is clamped so the window never leaves the display or slides under the menu
 * bar or under the phone. Pointer drags come from the title bar; keyboard users
 * get the same movement from arrow keys on a dedicated handle. Double-clicking
 * the title bar, or Home on the handle, puts the window back.
 */
export function useWindowDrag(windowRef: React.RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState<WindowOffset>(ORIGIN);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: WindowOffset;
    bounds: Bounds;
  } | null>(null);

  const measure = useCallback((): Bounds | null => {
    const win = windowRef.current;
    const screen = win?.offsetParent;
    if (!win || !(screen instanceof HTMLElement)) return null;
    const width = screen.clientWidth;
    const height = screen.clientHeight;
    if (!width || !height) return null;
    // offsetLeft/Top ignore transforms, so they are the untranslated CSS position.
    let xMax = width - win.offsetLeft - win.offsetWidth;
    // The phone sits over the right edge of the screen; the window stops short
    // of it so the terminal never disappears behind the viewer.
    const phone = screen.closest(".demoStage")?.querySelector(".iphone");
    if (phone) {
      const phoneLeft = phone.getBoundingClientRect().left - screen.getBoundingClientRect().left;
      xMax = Math.min(xMax, phoneLeft - PHONE_GAP - win.offsetLeft - win.offsetWidth);
    }
    return {
      width,
      height,
      xMin: -win.offsetLeft,
      // Never clamp tighter than the resting position, which is always legal.
      xMax: Math.max(0, xMax),
      yMin: MENU_BAR * width - win.offsetTop,
      yMax: height - win.offsetTop - win.offsetHeight,
    };
  }, [windowRef]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || drag.current) return;
    // Controls inside the title bar (the keyboard handle) are not drag grips.
    if (event.target instanceof Element && event.target.closest("button")) return;
    const bounds = measure();
    if (!bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offset,
      bounds,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const { bounds, origin } = current;
    setOffset(
      clampTo(
        bounds,
        (origin.x / 100) * bounds.width + (event.clientX - current.startX),
        (origin.y / 100) * bounds.height + (event.clientY - current.startY),
      ),
    );
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const nudge = (dx: number, dy: number) => {
    const bounds = measure();
    if (!bounds) return;
    setOffset((current) =>
      clampTo(
        bounds,
        ((current.x + dx) / 100) * bounds.width,
        ((current.y + dy) / 100) * bounds.height,
      ),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? KEY_STEP_FAST : KEY_STEP;
    switch (event.key) {
      case "ArrowLeft":
        nudge(-step, 0);
        break;
      case "ArrowRight":
        nudge(step, 0);
        break;
      case "ArrowUp":
        nudge(0, -step);
        break;
      case "ArrowDown":
        nudge(0, step);
        break;
      case "Home":
        setOffset(ORIGIN);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const reset = () => setOffset(ORIGIN);

  const style = { "--wx": offset.x, "--wy": offset.y } as CSSProperties;

  return {
    dragging,
    /** True once the window sits low enough that notes under it would leave the screen. */
    low: offset.y > LOW_AFTER,
    /** Set on the element whose children should move with the window. */
    style,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onDoubleClick: reset,
    },
    keyboardProps: { onKeyDown },
  };
}
