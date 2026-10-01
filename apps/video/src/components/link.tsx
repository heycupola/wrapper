import { interpolateColors } from "remotion";
import type { Point } from "../layout";
import { font, usePalette } from "../theme";
import { SCRIPT, typedEnd } from "../timeline";
import { T, easeInOut, mix, presence, progress } from "../timing";

const STROKE = 2;
const FLOW_EVERY = 0.3;
const FLOW_TRAVEL = 0.8;

const gitLine = SCRIPT.find((line) => line.typed?.text === "git status");
/* Windows where the phone is typing, so traffic runs phone → terminal. */
const INBOUND: [number, number][] = [
  [T.guestTyping - 0.3, gitLine ? typedEnd(gitLine) : T.guestTyping + 0.8],
  [T.attentionTap - 0.1, T.attentionTap + 0.35],
];

function lerp(a: Point, b: Point, p: number): Point {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/* A two-segment path from → bend → to, sampled by arc length. */
function makePath(from: Point, bend: Point, to: Point) {
  const first = distance(from, bend);
  const total = first + distance(bend, to);
  const at = (p: number): Point => {
    const d = p * total;
    if (d <= first) return lerp(from, bend, first === 0 ? 0 : d / first);
    return lerp(bend, to, (d - first) / (total - first));
  };
  const between = (p0: number, p1: number): Point[] => {
    const split = first / total;
    return p0 < split && p1 > split ? [at(p0), bend, at(p1)] : [at(p0), at(p1)];
  };
  return { at, between };
}

function Stroke({ points, stroke }: { points: Point[]; stroke: string }) {
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="none"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Chip({ t, at }: { t: number; at: Point }) {
  const color = usePalette();
  const { enter, opacity } = presence(t, T.direct, T.relayBack + 0.3);
  if (opacity <= 0) return null;
  const relayed = progress(t, T.relay + 0.3, 0.3) * (1 - progress(t, T.relayBack + 0.1, 0.2));
  const label = { position: "absolute", left: 0, right: 0, textAlign: "center" } as const;

  return (
    <div
      style={{
        position: "absolute",
        left: at.x,
        top: at.y,
        transform: `translate(-50%, -50%) translateY(${mix(8, 0, enter)}px)`,
        opacity,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${color.border}`,
        background: color.canvas,
        fontFamily: font.mono,
        fontSize: 14,
        color: color.inkMuted,
        whiteSpace: "pre",
      }}
    >
      <span style={{ visibility: "hidden" }}>relay · fallback</span>
      <span style={{ ...label, top: 8, opacity: 1 - relayed }}>direct · WebRTC</span>
      <span style={{ ...label, top: 8, opacity: relayed }}>relay · fallback</span>
    </div>
  );
}

/* The path between terminal and phone. Grey when idle, blue only while live. */
export function Link({
  t,
  from,
  to,
  relayOffset,
  chipOffset,
  fade,
}: {
  t: number;
  from: Point;
  to: Point;
  relayOffset: Point;
  chipOffset: Point;
  fade: number;
}) {
  const color = usePalette();
  const draw = progress(t, T.linkDraw, 0.6, easeInOut);
  const fill = progress(t, T.live, 0.45, easeInOut);
  const cool = progress(t, T.unshare, 0.35);
  const gap = progress(t, T.unshare, 0.6);
  const bendAmount =
    progress(t, T.relay, 0.7, easeInOut) * (1 - progress(t, T.relayBack, 0.7, easeInOut));

  const middle = lerp(from, to, 0.5);
  const bend = {
    x: middle.x + relayOffset.x * bendAmount,
    y: middle.y + relayOffset.y * bendAmount,
  };
  const path = makePath(from, bend, to);
  const blue = interpolateColors(cool, [0, 1], [color.live, color.line]);
  const half = 0.5 * (1 - gap);

  const flows: { p: number; inbound: boolean }[] = [];
  const first = T.live + 0.4;
  for (let start = first; start < T.unshare; start += FLOW_EVERY) {
    const p = (t - start) / FLOW_TRAVEL;
    if (p <= 0 || p >= 1) continue;
    const inbound = INBOUND.some(([a, b]) => start >= a && start <= b);
    flows.push({ p: inbound ? 1 - p : p, inbound });
  }

  return (
    <>
      <svg
        width={1}
        height={1}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: fade }}
      >
        {gap === 0 ? (
          <>
            <Stroke points={path.between(0, draw)} stroke={color.line} />
            {fill > 0 ? <Stroke points={path.between(0, fill)} stroke={blue} /> : null}
          </>
        ) : (
          <>
            <Stroke points={path.between(0, half)} stroke={blue} />
            <Stroke points={path.between(1 - half, 1)} stroke={blue} />
          </>
        )}

        {flows.map(({ p, inbound }) => {
          const dot = path.at(easeInOut(p));
          const edge = Math.min(p, 1 - p) * 6;
          return (
            <circle
              key={`${inbound}-${p}`}
              cx={dot.x}
              cy={dot.y}
              r={inbound ? 4 : 3.5}
              fill={inbound ? color.ink : color.live}
              opacity={Math.min(1, edge) * (1 - cool)}
            />
          );
        })}

        {[from, to].map((node, i) => (
          <circle
            key={i}
            cx={node.x}
            cy={node.y}
            r={4.5}
            fill={color.canvas}
            stroke={fill >= (i === 0 ? 0.01 : 0.99) ? blue : color.line}
            strokeWidth={STROKE}
            opacity={i === 0 ? progress(t, T.linkDraw, 0.3) : progress(t, T.linkDraw + 0.5, 0.2)}
          />
        ))}
      </svg>

      {bendAmount > 0 ? (
        <div
          style={{
            position: "absolute",
            left: bend.x,
            top: bend.y,
            transform: `translate(-50%, -50%) scale(${mix(0.9, 1, bendAmount)})`,
            opacity: bendAmount * fade,
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${blue}`,
            background: color.canvas,
            fontFamily: font.mono,
            fontSize: 14,
            color: color.ink,
          }}
        >
          relay
        </div>
      ) : null}

      <div style={{ opacity: fade }}>
        <Chip t={t} at={{ x: middle.x + chipOffset.x, y: middle.y + chipOffset.y }} />
      </div>
    </>
  );
}
