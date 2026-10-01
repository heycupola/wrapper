import type { CSSProperties } from "react";
import { MONO_ADVANCE, TERMINAL } from "../layout";
import { font, useDevice, type Device } from "../theme";
import { RUN_WORDS, SCRIPT, typedEnd, type ScriptLine, type Tone } from "../timeline";
import { T, mix, progress } from "../timing";

export const COMMAND = SCRIPT[0]?.typed?.text ?? "";

function tones(device: Device): Record<Tone, CSSProperties> {
  return {
    ink: { color: device.ink },
    strong: { color: device.ink, fontWeight: 600 },
    muted: { color: device.inkMuted },
    faint: { color: device.inkFaint },
  };
}

function useTone(): Record<Tone, CSSProperties> {
  return tones(useDevice());
}

const lineStyle: CSSProperties = {
  height: TERMINAL.lineHeight,
  lineHeight: `${TERMINAL.lineHeight}px`,
  whiteSpace: "pre",
};

function Prompt() {
  return <span style={useTone().faint}>$ </span>;
}

export function Cursor({
  t,
  solid = false,
  color,
}: {
  t: number;
  solid?: boolean;
  color?: string;
}) {
  const device = useDevice();
  const on = solid || ((t % 1) + 1) % 1 < 0.55;
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.6em",
        height: "1.1em",
        marginBottom: "-0.2em",
        background: color ?? device.ink,
        opacity: on ? 1 : 0,
      }}
    />
  );
}

function typedChars(line: ScriptLine, t: number): number {
  if (!line.typed) return 0;
  const n = Math.floor((t - line.typed.at) / line.typed.rate) + 1;
  return Math.max(0, Math.min(line.typed.text.length, n));
}

function isTyping(line: ScriptLine, t: number): boolean {
  if (!line.typed) return false;
  return t >= line.typed.at && t < typedEnd(line) + 0.25;
}

/* The line that owns the cursor: the most recent one that takes input. */
function cursorLine(t: number): number {
  let owner = -1;
  let latest = -Infinity;
  SCRIPT.forEach((line, i) => {
    if (!(line.prompt || line.typed) || t < line.at) return;
    const since = Math.max(line.at, line.typed && t >= line.typed.at ? line.typed.at : line.at);
    if (since >= latest) {
      latest = since;
      owner = i;
    }
  });
  return owner;
}

/*
 * Rows a line occupies when word-wrapped at `columns`, mirroring the browser's pre-wrap layout:
 * breaks fall after spaces, and the cursor (an inline block) can wrap on its own.
 */
function wrappedRows(line: ScriptLine, t: number, hasCursor: boolean, columns: number): number {
  const text = `${line.prompt ? "$ " : ""}${line.parts?.map((part) => part.text).join("") ?? ""}${
    line.typed?.text.slice(0, typedChars(line, t)) ?? ""
  }`;
  const words = text.split(/(?<= )/);
  if (hasCursor) words.push("\u2588");
  let rows = 1;
  let used = 0;
  for (const word of words) {
    const visible = word.trimEnd().length;
    if (used > 0 && used + visible > columns) {
      rows += 1;
      used = 0;
    }
    used += word.length;
  }
  return rows;
}

/* Wrapped text may only break at spaces; hyphens and slashes stay joined, as `wrappedRows` assumes. */
function Words({ text, wrap }: { text: string; wrap: boolean }) {
  if (!wrap) return text;
  return text.split(/( +)/).map((token, i) =>
    token.trim() === "" ? (
      token
    ) : (
      <span key={i} style={{ whiteSpace: "nowrap" }}>
        {token}
      </span>
    ),
  );
}

function ShareSession({ t, rows, columns }: { t: number; rows: number; columns?: number }) {
  const TONE = useTone();
  const owner = cursorLine(t);
  const heights = SCRIPT.map((line, i) => {
    const wrapped = columns ? wrappedRows(line, t, i === owner, columns) : 1;
    return wrapped * (i === 0 ? 1 : progress(t, line.at, 0.26));
  });
  const height = heights.reduce((sum, h) => sum + h, 0);
  const scroll = Math.max(0, height - rows) * TERMINAL.lineHeight;

  return (
    <div style={{ height: rows * TERMINAL.lineHeight, overflow: "hidden" }}>
      <div style={{ transform: `translateY(${-scroll}px)` }}>
        {SCRIPT.map((line, i) => {
          const h = heights[i] ?? 0;
          if (h <= 0) return null;
          const chars = typedChars(line, t);
          return (
            <div
              key={i}
              style={{
                ...lineStyle,
                ...(columns
                  ? {
                      width: columns * TERMINAL.fontSize * MONO_ADVANCE + 1,
                      whiteSpace: "pre-wrap",
                    }
                  : null),
                height: h * TERMINAL.lineHeight,
                opacity: i === 0 ? 1 : progress(t, line.at, 0.26),
                overflow: "hidden",
              }}
            >
              {line.prompt ? <Prompt /> : null}
              {line.parts?.map((part, j) => (
                <span key={j} style={TONE[part.tone]}>
                  <Words text={part.text} wrap={Boolean(columns)} />
                </span>
              ))}
              {line.typed ? (
                <span style={TONE.ink}>
                  <Words text={line.typed.text.slice(0, chars)} wrap={Boolean(columns)} />
                </span>
              ) : null}
              {i === owner ? <Cursor t={t} solid={isTyping(line, t)} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunWord({ t }: { t: number }) {
  const device = useDevice();
  const index = Math.max(
    0,
    Math.min(RUN_WORDS.length - 1, Math.floor((t - T.runWords) / T.runWordSeconds) + 1),
  );
  const switchedAt = T.runWords + (index - 1) * T.runWordSeconds;
  const p = index === 0 ? 1 : progress(t, switchedAt, 0.3);
  const previous = index > 0 ? RUN_WORDS[index - 1] : null;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {previous && p < 1 ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            color: device.ink,
            opacity: 1 - p,
            transform: `translateY(${mix(0, -14, p)}px)`,
          }}
        >
          {previous}
        </span>
      ) : null}
      <span
        style={{
          display: "inline-block",
          color: device.ink,
          opacity: p,
          transform: `translateY(${mix(14, 0, p)}px)`,
        }}
      >
        {RUN_WORDS[index]}
      </span>
    </span>
  );
}

function RunSession({ t }: { t: number }) {
  const TONE = useTone();
  return (
    <div style={lineStyle}>
      <Prompt />
      <span style={TONE.ink}>wrapper run -- </span>
      <RunWord t={t} />
      <span> </span>
      <Cursor t={t} />
    </div>
  );
}

/* The terminal contents. The phone renders the same session, wrapped to its own `columns`. */
export function TerminalScreen({
  t,
  rows,
  columns,
}: {
  t: number;
  rows: number;
  columns?: number;
}) {
  const device = useDevice();
  const shareOut = progress(t, T.regroup, 0.3);
  const runIn = progress(t, T.regroup + 0.35, 0.5);

  return (
    <div
      style={{
        position: "relative",
        fontFamily: font.mono,
        fontSize: TERMINAL.fontSize,
        color: device.ink,
      }}
    >
      {shareOut < 1 ? (
        <div style={{ opacity: 1 - shareOut }}>
          <ShareSession t={t} rows={rows} columns={columns} />
        </div>
      ) : null}
      {runIn > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: runIn,
            transform: `translateY(${mix(8, 0, runIn)}px)`,
          }}
        >
          <RunSession t={t} />
        </div>
      ) : null}
    </div>
  );
}
