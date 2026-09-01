"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { DemoAction, DemoDevice, DemoState, TerminalLine } from "./demo-session";
import type { DemoSend } from "./use-demo-session";

/**
 * A zero-width space keeps the hidden input non-empty so a soft keyboard's
 * Backspace shows up as an `input` event with the sentinel removed. Desktop
 * browsers never get that far: `keydown` claims every key and prevents default.
 */
const SENTINEL = "\u200b";
const CTRL_KEYS = new Set(["\\", "|", "g", "c", "l", "u", "w", "backspace"]);

/**
 * Which keystrokes the shell claims. Everything else (⌘C, ⌘L, ⇧Tab, …) is
 * left to the browser. Tab completes like zsh, so it is claimed; Escape blurs
 * the terminal, which is the way out for keyboard users.
 */
export function keyActionFromEvent(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
}): DemoAction | null {
  const { key, ctrlKey, metaKey, altKey, shiftKey = false } = event;
  if (metaKey) return key === "Backspace" ? { type: "key", key, meta: true } : null;
  if (ctrlKey) {
    if (!CTRL_KEYS.has(key.toLowerCase())) return null;
    return { type: "key", key: key === "Backspace" ? key : key.toLowerCase(), ctrl: true };
  }
  if (altKey) return key === "Backspace" ? { type: "key", key, alt: true } : null;
  switch (key) {
    case "Tab":
      return shiftKey ? null : { type: "key", key };
    case "Enter":
    case "Backspace":
    case "ArrowUp":
    case "ArrowDown":
    case "Escape":
      return { type: "key", key };
    default:
      return key.length === 1 ? { type: "key", key } : null;
  }
}

export function useTerminalInput(
  device: DemoDevice,
  send: DemoSend,
  options: { ctrlArmed?: boolean; onCtrlConsumed?: () => void } = {},
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ctrlArmed = false, onCtrlConsumed } = options;

  /* Text inputs match :focus-visible even when focused by a click, which would
     draw the keyboard focus ring around the window on every tap. `focus()` is
     only ever called from pointer handlers and timers, so focus that arrives
     through it is tagged as such; a real Tab keeps the ring. */
  const programmatic = useRef(false);
  const focus = useCallback(() => {
    programmatic.current = true;
    inputRef.current?.focus({ preventScroll: true });
    programmatic.current = false;
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) return;
      const action = keyActionFromEvent({
        key: event.key,
        ctrlKey: event.ctrlKey || (ctrlArmed && event.key.length === 1),
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      if (!action) return;
      if (ctrlArmed && event.key.length === 1) onCtrlConsumed?.();
      event.preventDefault();
      event.stopPropagation();
      if (action.type === "key" && action.key === "Escape") inputRef.current?.blur();
      send(action);
    },
    [ctrlArmed, onCtrlConsumed, send],
  );

  const onInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const value = input.value;
      input.value = SENTINEL;
      if (!value.includes(SENTINEL)) {
        send({ type: "key", key: "Backspace" });
        return;
      }
      for (const char of value.replace(SENTINEL, "")) {
        if (char === "\n" || char === "\r") send({ type: "key", key: "Enter" });
        else if (ctrlArmed) {
          onCtrlConsumed?.();
          send({ type: "key", key: char.toLowerCase(), ctrl: true });
        } else send({ type: "key", key: char });
      }
    },
    [ctrlArmed, onCtrlConsumed, send],
  );

  const onFocus = useCallback(() => {
    const input = inputRef.current;
    if (input) {
      input.value = SENTINEL;
      if (programmatic.current) input.dataset.focusSource = "pointer";
      else delete input.dataset.focusSource;
    }
    send({ type: "focus", device });
  }, [device, send]);

  const onBlur = useCallback(() => send({ type: "focus", device: null }), [send]);

  const inputProps = {
    ref: inputRef,
    className: "demoKeyboardTarget",
    type: "text" as const,
    defaultValue: SENTINEL,
    autoCapitalize: "off",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    "aria-label":
      device === "mac"
        ? "Demo terminal on the MacBook. Type shell commands, Tab completes, Escape leaves the terminal; press Control and backslash, then s, to share."
        : "Demo terminal on the iPhone. Keystrokes reach the shared shell; Escape leaves the terminal.",
    onKeyDown,
    onInput,
    onFocus,
    onBlur,
  };

  return { inputRef, focus, inputProps } as const;
}

/**
 * Keeps a scrollback pinned to its newest line as output arrives. The
 * scrollback only claims wheel events from the page's smooth scroller once it
 * actually overflows, so an empty terminal never traps the visitor's scroll.
 */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, dependency: unknown) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const stick = () => {
      node.scrollTop = node.scrollHeight;
      if (node.scrollHeight > node.clientHeight + 1) node.dataset.lenisPrevent = "";
      else delete node.dataset.lenisPrevent;
    };
    stick();
    // The scrollback is sized in container units, so a rotation or window
    // resize changes its line height; re-pin rather than strand the visitor
    // mid-buffer.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(stick);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, dependency]);
}

export function TerminalLines({
  lines,
  input,
  cwd,
  focused,
  showCaret = true,
}: {
  lines: readonly TerminalLine[];
  input: string;
  cwd: string;
  focused: boolean;
  showCaret?: boolean;
}) {
  return (
    <>
      {lines.map((line) => (
        <TerminalLineView key={line.id} line={line} />
      ))}
      <p className="demoLine isCommand isPromptLine" aria-live="off">
        <Prompt cwd={cwd} />
        <span className="demoInput">{input}</span>
        {showCaret ? (
          <span className={`demoCaret ${focused ? "isFocused" : ""}`} aria-hidden="true" />
        ) : null}
      </p>
    </>
  );
}

function TerminalLineView({ line }: { line: TerminalLine }) {
  if (line.kind === "command") {
    return (
      <p className="demoLine isCommand">
        <Prompt cwd={line.cwd ?? "~"} />
        <span>{line.text}</span>
      </p>
    );
  }
  if (line.kind === "wrapper") {
    return (
      <p className="demoLine isWrapper">
        <span className="demoTag">[wrapper]</span> {line.text}
      </p>
    );
  }
  return <p className={`demoLine is${capitalize(line.kind)}`}>{line.text || "\u00a0"}</p>;
}

function Prompt({ cwd }: { cwd: string }) {
  return (
    <span className="demoPrompt">
      <span className="demoCwd">{cwd}</span> <span className="demoChevron">❯</span>{" "}
    </span>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Polite announcements for assistive tech: only the `[wrapper]` status lines. */
export function useWrapperAnnouncements(state: DemoState) {
  const lastAnnounced = useRef<number>(0);
  const liveRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let latest: TerminalLine | undefined;
    for (const line of state.lines) if (line.kind === "wrapper") latest = line;
    if (!latest || latest.id === lastAnnounced.current) return;
    lastAnnounced.current = latest.id;
    if (liveRef.current) liveRef.current.textContent = `wrapper: ${latest.text}`;
  }, [state.lines]);
  return liveRef;
}
