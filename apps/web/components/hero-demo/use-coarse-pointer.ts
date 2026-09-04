"use client";

import { useSyncExternalStore } from "react";

/**
 * The hero's input surfaces (typing into the shell, dragging the window) are
 * only offered where a real keyboard and a fine pointer are at hand. Anything
 * else counts as touch: a phone, a tablet without a trackpad, a kiosk. Layout
 * is decided separately by width; a keyboard-equipped iPad gets the compact
 * layout but keeps typing, a touch-only desktop-sized screen does not.
 */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => !window.matchMedia(FINE_POINTER).matches;
// Server render and the hydration pass assume a fine pointer, so the markup
// matches; a touch device switches on the first client render.
const getServerSnapshot = () => false;

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
