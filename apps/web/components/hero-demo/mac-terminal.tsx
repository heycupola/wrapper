"use client";

import { type RefObject, useEffect, useRef } from "react";
import { type DemoState, hostTitle, hostTransport } from "./demo-session";
import { TerminalLines, useStickToBottom, useTerminalInput } from "./terminal-view";
import type { DemoSend } from "./use-demo-session";
import type { useWindowDrag } from "./use-window-drag";

type Drag = ReturnType<typeof useWindowDrag>;

/**
 * The guide says "press ⌃\ then s", so the chord should work before the
 * visitor has clicked into the window. While the window is on screen and no
 * other field has focus, ⌃\ anywhere on the page focuses the shell and arms
 * it; the `s` that follows lands in the terminal as usual. Only the prefix is
 * claimed globally — plain letters keep belonging to the page.
 */
function usePagePrefix(
  windowRef: RefObject<HTMLElement | null>,
  focus: () => void,
  send: DemoSend,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "\\" && event.key !== "|") return;
      if (event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      ) {
        return;
      }
      const node = windowRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
      ) {
        return;
      }
      event.preventDefault();
      focus();
      send({ type: "key", key: "\\", ctrl: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, focus, send, windowRef]);
}

/**
 * The terminal window on the Mac. With a keyboard and a fine pointer it is a
 * live shell: tapping focuses it, the title bar drags it. On touch the loop is
 * driven from the guide's buttons instead, so the window is display only: no
 * hidden input to summon a soft keyboard over the page, no drag grip to fight
 * the page's scroll, and no caret promising input.
 */
export function MacTerminal({
  state,
  send,
  windowRef,
  drag,
  touch = false,
}: {
  state: DemoState;
  send: DemoSend;
  windowRef: RefObject<HTMLElement | null>;
  drag: Drag;
  touch?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { focus, inputProps } = useTerminalInput("mac", send);
  const focused = state.focus === "mac";
  useStickToBottom(scrollRef, state.lines.length + state.input.length);
  usePagePrefix(windowRef, focus, send, !touch);

  return (
    <section
      ref={windowRef}
      className={`macWindow demoMacWindow ${focused ? "isFocused" : ""} ${drag.dragging ? "isDragging" : ""}`}
      aria-label="Host terminal"
      data-transport={hostTransport(state)}
      data-armed={state.armed ? "true" : "false"}
      onPointerDown={
        touch
          ? undefined
          : (event) => {
              // Let real text selection happen inside the scrollback; anything
              // else focuses the shell so the next keystroke lands in it.
              if (event.button !== 0) return;
              if (window.getSelection()?.toString()) return;
              event.preventDefault();
              focus();
            }
      }
    >
      <header className="macTitlebar" {...(touch ? {} : drag.handleProps)}>
        <span className="macTraffic" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h3 className={state.armed ? "isArmed" : ""}>{hostTitle(state)}</h3>
      </header>
      <div className="macContent demoScrollback" ref={scrollRef}>
        <TerminalLines
          lines={state.lines}
          input={state.input}
          cwd={state.cwd}
          focused={focused}
          showCaret={!touch}
        />
        {touch ? null : <input {...inputProps} />}
      </div>
      {/* Drawn in the title bar, but placed after the shell in the DOM so Tab
          reaches the terminal first and window-moving second. */}
      {touch ? null : (
        <button
          type="button"
          className="macMoveHandle"
          aria-label="Move the terminal window. Use the arrow keys; Home puts it back."
          {...drag.keyboardProps}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 1.5v13M1.5 8h13M8 1.5 5.8 3.7M8 1.5l2.2 2.2M8 14.5l-2.2-2.2M8 14.5l2.2-2.2M1.5 8l2.2-2.2M1.5 8l2.2 2.2M14.5 8l-2.2-2.2M14.5 8l-2.2 2.2"
            />
          </svg>
        </button>
      )}
    </section>
  );
}
