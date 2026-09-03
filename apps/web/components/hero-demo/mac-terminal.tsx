"use client";

import { type RefObject, useRef } from "react";
import { type DemoState, hostTitle, hostTransport } from "./demo-session";
import { TerminalLines, useStickToBottom, useTerminalInput } from "./terminal-view";
import type { DemoSend } from "./use-demo-session";
import type { useWindowDrag } from "./use-window-drag";

type Drag = ReturnType<typeof useWindowDrag>;

export function MacTerminal({
  state,
  send,
  windowRef,
  drag,
}: {
  state: DemoState;
  send: DemoSend;
  windowRef: RefObject<HTMLElement | null>;
  drag: Drag;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { focus, inputProps } = useTerminalInput("mac", send);
  const focused = state.focus === "mac";
  useStickToBottom(scrollRef, state.lines.length + state.input.length);

  return (
    <section
      ref={windowRef}
      className={`macWindow demoMacWindow ${focused ? "isFocused" : ""} ${drag.dragging ? "isDragging" : ""}`}
      aria-label="Host terminal"
      data-transport={hostTransport(state)}
      data-armed={state.armed ? "true" : "false"}
      onPointerDown={(event) => {
        // Let real text selection happen inside the scrollback; anything else
        // focuses the shell so the next keystroke lands in it.
        if (event.button !== 0) return;
        if (window.getSelection()?.toString()) return;
        event.preventDefault();
        focus();
      }}
    >
      <header className="macTitlebar" {...drag.handleProps}>
        <span className="macTraffic" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h3 className={state.armed ? "isArmed" : ""}>{hostTitle(state)}</h3>
      </header>
      <div className="macContent demoScrollback" ref={scrollRef}>
        <TerminalLines lines={state.lines} input={state.input} cwd={state.cwd} focused={focused} />
        <input {...inputProps} />
      </div>
      {/* Drawn in the title bar, but placed after the shell in the DOM so Tab
          reaches the terminal first and window-moving second. */}
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
    </section>
  );
}
