"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type DemoState, guideStep } from "./demo-session";
import type { DemoSend } from "./use-demo-session";

/** How much of the stage has to be on screen before the loop starts. */
const VISIBLE_RATIO = 0.5;
/** Pauses that read as a person deciding, not a script firing. */
const BEFORE_SHARE_MS = 1800;
const BEFORE_TAP_MS = 1600;
const BEFORE_TYPING_MS = 900;
const KEYSTROKE_MS = 120;
const BEFORE_UNSHARE_MS = 3200;
/** What the phone "types" once it is attached. */
const TYPED_COMMAND = "ls";

type Phase = "waiting" | "playing" | "stopped";

/**
 * Walks the demo once on its own where nobody is going to type: on touch, most
 * visitors scroll past a demo that waits for a tap, and would never see that
 * the phone attaches or that a keystroke lands on both screens. The run starts
 * when the stage is mostly in view, follows the same steps the guide asks
 * for, and stops for good the moment the visitor does anything themselves or
 * scrolls the stage away. Off when motion is reduced, and off with a keyboard,
 * where the notes invite the visitor to drive.
 */
export function useDemoAutoplay(
  stageRef: RefObject<HTMLElement | null>,
  state: DemoState,
  send: DemoSend,
  enabled: boolean,
) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const stop = useCallback(() => setPhase("stopped"), []);

  // Start when the stage scrolls into view; give up if it scrolls away again.
  useEffect(() => {
    if (!enabled || phase === "stopped") return;
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= VISIBLE_RATIO) setPhase("playing");
        else setPhase((current) => (current === "playing" ? "stopped" : current));
      },
      { threshold: [VISIBLE_RATIO] },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [enabled, phase, stageRef]);

  // Drive the loop step by step. Each step schedules only its own next move,
  // so the state machine's own latencies (relay, ticket, P2P) still pace it.
  const step = guideStep(state);
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!enabled || phase !== "playing") return;
    const timers: number[] = [];
    const after = (delay: number, run: () => void) => {
      timers.push(window.setTimeout(run, delay));
    };
    switch (step) {
      case "share":
        after(BEFORE_SHARE_MS, () => sendRef.current({ type: "hostCommand", command: "share" }));
        break;
      case "tap":
        after(BEFORE_TAP_MS, () => sendRef.current({ type: "tapSession" }));
        break;
      case "live": {
        let at = BEFORE_TYPING_MS;
        for (const key of TYPED_COMMAND) {
          after(at, () => sendRef.current({ type: "key", key }));
          at += KEYSTROKE_MS;
        }
        after(at, () => sendRef.current({ type: "key", key: "Enter" }));
        after(at + BEFORE_UNSHARE_MS, () =>
          sendRef.current({ type: "hostCommand", command: "unshare" }),
        );
        break;
      }
      case "done":
        setPhase("stopped");
        break;
      case "sharing":
      case "connecting":
        break;
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [enabled, phase, step]);

  /** Call from anything the visitor does; the script yields to them. */
  return { stop } as const;
}
