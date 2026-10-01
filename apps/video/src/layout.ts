import { useVideoConfig } from "remotion";

export type Point = { x: number; y: number };

export type Layout = {
  vertical: boolean;
  terminal: { width: number; height: number };
  phone: { width: number; height: number };
  /* Stage coordinates are pixels from the frame centre. */
  solo: Point;
  split: { terminal: Point; phone: Point };
  headline: { y: number; size: number; maxWidth: number };
  /*
   * The notification close-up: camera offset from the phone centre and zoom. The zoom is deep
   * enough that the bottom of the phone leaves the frame.
   */
  closeUp: { offset: Point; scale: number };
  /* Where the close-up headline sits: `x` is its left edge ("left") or centre ("center"). */
  closeUpHeadline: { x: number; y: number; size: number; align: "left" | "center" };
  endScale: number;
  /* How far the path bends to reach the relay, and where its label sits. */
  relay: Point;
  chip: Point;
};

/* Geist Mono advance width, in em. */
export const MONO_ADVANCE = 0.6;

export const TERMINAL = {
  titleBar: 44,
  padX: 30,
  padTop: 26,
  fontSize: 20,
  lineHeight: 32,
} as const;

const landscape: Layout = {
  vertical: false,
  terminal: { width: 720, height: 380 },
  phone: { width: 300, height: 620 },
  solo: { x: 0, y: -60 },
  split: { terminal: { x: -330, y: -60 }, phone: { x: 505, y: -60 } },
  headline: { y: 400, size: 54, maxWidth: 1400 },
  closeUp: { offset: { x: 139, y: -66 }, scale: 1.8 },
  closeUpHeadline: { x: 110, y: -20, size: 80, align: "left" },
  endScale: 1,
  relay: { x: 0, y: -190 },
  chip: { x: 0, y: 44 },
};

const vertical: Layout = {
  vertical: true,
  terminal: { width: 720, height: 380 },
  phone: { width: 300, height: 620 },
  solo: { x: 0, y: -160 },
  split: { terminal: { x: 0, y: -470 }, phone: { x: 0, y: 240 } },
  headline: { y: 760, size: 72, maxWidth: 940 },
  closeUp: { offset: { x: 0, y: -90 }, scale: 2.6 },
  closeUpHeadline: { x: 0, y: -770, size: 84, align: "center" },
  endScale: 1.15,
  relay: { x: 300, y: 0 },
  chip: { x: -150, y: 0 },
};

export function useLayout(): Layout {
  const { width, height } = useVideoConfig();
  return height > width ? vertical : landscape;
}

/* Where the link leaves the terminal and meets the phone. */
export function linkEnds(layout: Layout): { from: Point; to: Point } {
  const { terminal, phone, split } = layout;
  if (layout.vertical) {
    return {
      from: { x: split.terminal.x, y: split.terminal.y + terminal.height / 2 },
      to: { x: split.phone.x, y: split.phone.y - phone.height / 2 },
    };
  }
  return {
    from: { x: split.terminal.x + terminal.width / 2, y: split.terminal.y },
    to: { x: split.phone.x - phone.width / 2, y: split.phone.y },
  };
}
