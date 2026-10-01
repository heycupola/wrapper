import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export { DURATION_SECONDS, FPS, T } from "./timeline";

/* Standard exit curve from BRAND.md; every move in the film uses it. */
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export function useTime(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/* 0 → 1 progress of a move that starts at `start` and lasts `duration` seconds. */
export function progress(
  t: number,
  start: number,
  duration: number,
  easing: (n: number) => number = ease,
): number {
  return interpolate(t, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

export function mix(from: number, to: number, p: number): number {
  return from + (to - from) * p;
}

/* Entrance at `start` (480ms) and exit at `end` (280ms). */
export function presence(t: number, start: number, end = Infinity) {
  const enter = progress(t, start, 0.48);
  const exit = progress(t, end, 0.28);
  return { enter, exit, opacity: enter * (1 - exit) };
}

/* A key or tap: 0 → 1 → 0 over 200ms. */
export function press(t: number, at: number): number {
  return interpolate(t, [at, at + 0.07, at + 0.2], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
