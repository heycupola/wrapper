import { font, usePalette } from "../theme";
import { PREFIX_LEAD } from "../timeline";
import { mix, presence, press } from "../timing";

function Key({ label, down }: { label: string; down: number }) {
  const color = usePalette();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        height: 44,
        padding: "0 14px",
        borderRadius: 10,
        border: `1px solid ${color.border}`,
        background: down > 0 ? color.surfaceMuted : color.surface,
        fontFamily: font.mono,
        fontSize: 17,
        color: color.ink,
        transform: `scale(${mix(1, 0.93, down)}) translateY(${down * 1.5}px)`,
      }}
    >
      {label}
    </span>
  );
}

/* Ctrl+\ then a key, pressed on screen at `pressAt`. */
export function KeyHint({
  t,
  keyLabel,
  showAt,
  pressAt,
}: {
  t: number;
  keyLabel: string;
  showAt: number;
  pressAt: number;
}) {
  const color = usePalette();
  const { enter, opacity } = presence(t, showAt, pressAt + 0.45);
  if (opacity <= 0) return null;
  const prefix = press(t, pressAt - PREFIX_LEAD);
  const key = press(t, pressAt);

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 8,
        borderRadius: 16,
        background: color.canvas,
        opacity,
        transform: `translate(-50%, -50%) translateY(${mix(10, 0, enter)}px)`,
        filter: `blur(${(1 - enter) * 6}px)`,
        fontFamily: font.sans,
        fontSize: 15,
        color: color.inkFaint,
        whiteSpace: "nowrap",
      }}
    >
      <Key label="Ctrl" down={prefix} />
      <Key label="\" down={prefix} />
      <span style={{ padding: "0 6px" }}>then</span>
      <Key label={keyLabel} down={key} />
    </div>
  );
}
