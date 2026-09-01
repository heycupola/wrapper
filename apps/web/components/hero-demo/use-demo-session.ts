"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createDemoState,
  type DemoAction,
  type DemoState,
  nextTimerAt,
  reduceDemo,
} from "./demo-session";

export interface Keycap {
  id: number;
  label: string;
}

const KEYCAP_LIFETIME_MS = 1400;
const PREFIX_CAP = "⌃ \\";

const clock = () => (typeof performance === "undefined" ? Date.now() : performance.now());

/**
 * Binds the pure demo reducer to real time. Every user action is preceded by
 * a `tick` so scheduled effects are measured from the actual moment of the
 * interaction, and a single timeout wakes the reducer when the next effect is
 * due. Keycaps are UI-only: they echo the prefix sequence so a visitor who
 * clicks the guide still sees which keys the CLI would have taken.
 */
export function useDemoSession() {
  const [state, dispatch] = useReducer(reduceDemo, undefined, () => createDemoState(clock()));
  const [keycaps, setKeycaps] = useState<Keycap[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const keycapId = useRef(0);

  const pushKeycap = useCallback((label: string) => {
    const id = ++keycapId.current;
    setKeycaps((current) => [...current.slice(-3), { id, label }]);
    window.setTimeout(() => {
      setKeycaps((current) => current.filter((cap) => cap.id !== id));
    }, KEYCAP_LIFETIME_MS);
  }, []);

  const send = useCallback(
    (action: DemoAction) => {
      const before = stateRef.current;
      if (action.type === "prefix") pushKeycap(PREFIX_CAP);
      if (action.type === "hostCommand") {
        if (!before.armed) pushKeycap(PREFIX_CAP);
        pushKeycap(hostKeyLabel(action.command));
      }
      if (action.type === "key") {
        if (action.ctrl && (action.key === "\\" || action.key === "|" || action.key === "g")) {
          if (!before.armed) pushKeycap(PREFIX_CAP);
        } else if (before.armed && action.key.length === 1) {
          pushKeycap(action.key);
        }
      }
      dispatch({ type: "tick", now: clock() });
      dispatch(action);
    },
    [pushKeycap],
  );

  const dueAt = nextTimerAt(state);
  useEffect(() => {
    if (dueAt === null) return;
    const delay = Math.max(16, dueAt - clock());
    const handle = window.setTimeout(() => dispatch({ type: "tick", now: clock() }), delay);
    return () => window.clearTimeout(handle);
  }, [dueAt, state.timers.length]);

  return { state, send, keycaps } as const;
}

export type DemoSend = (action: DemoAction) => void;
export type { DemoState };

function hostKeyLabel(command: "share" | "unshare" | "status" | "detach"): string {
  switch (command) {
    case "share":
      return "s";
    case "unshare":
      return "u";
    case "status":
      return "?";
    case "detach":
      return "d";
  }
}
