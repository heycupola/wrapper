import { interpolateColors } from "remotion";
import { TERMINAL, type Layout } from "../layout";
import { font, useDevice } from "../theme";
import { SESSION_TAG } from "../timeline";
import { T, progress } from "../timing";
import { TerminalScreen } from "./terminal-screen";

export const TERMINAL_ROWS = 9;

export function liveness(t: number): number {
  return progress(t, T.live, 0.5) * (1 - progress(t, T.unshare, 0.4));
}

function Title({ t }: { t: number }) {
  const device = useDevice();
  const idle = progress(t, T.unshare + 0.2, 0.3);
  const dot = interpolateColors(liveness(t), [0, 1], [device.border, device.live]);
  const text = { position: "absolute", left: 18, whiteSpace: "pre" } as const;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        fontFamily: font.sans,
        fontSize: 14,
        fontWeight: 510,
        color: device.inkMuted,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: dot }} />
      <span style={{ ...text, opacity: 1 - idle }}>wrapper • shared • {SESSION_TAG}</span>
      <span style={{ ...text, opacity: idle }}>wrapper • idle • {SESSION_TAG}</span>
      <span style={{ visibility: "hidden", marginLeft: 10 }}>wrapper • shared • {SESSION_TAG}</span>
    </div>
  );
}

export function TerminalWindow({
  t,
  layout,
  chrome,
}: {
  t: number;
  layout: Layout;
  chrome: number;
}) {
  const device = useDevice();
  const { width, height } = layout.terminal;

  return (
    <div style={{ position: "relative", width, height }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          background: device.terminal,
          border: `1px solid ${device.border}`,
          opacity: chrome,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: TERMINAL.titleBar,
          borderBottom: `1px solid ${device.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: chrome,
        }}
      >
        <div style={{ position: "absolute", left: 18, display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ width: 11, height: 11, borderRadius: 6, background: device.border }}
            />
          ))}
        </div>
        <Title t={t} />
      </div>
      <div
        style={{
          position: "absolute",
          left: TERMINAL.padX,
          right: TERMINAL.padX,
          top: TERMINAL.titleBar + TERMINAL.padTop,
        }}
      >
        <TerminalScreen t={t} rows={TERMINAL_ROWS} />
      </div>
    </div>
  );
}
