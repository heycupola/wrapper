import { interpolateColors } from "remotion";
import { MONO_ADVANCE, TERMINAL, type Layout } from "../layout";
import { font, useDevice } from "../theme";
import { SCRIPT, SESSION_TAG, typedEnd } from "../timeline";
import { T, ease, mix, press, progress } from "../timing";
import { Mark } from "./mark";
import { TerminalScreen } from "./terminal-screen";
import { liveness } from "./terminal-window";

const BEZEL = 10;
const SCREEN_PAD = 16;
const MIRROR_TOP = 90;
/* The phone renders the session at a readable size and wraps it, as a mobile terminal does. */
const MIRROR_SCALE = 0.66;
const MIRROR_ROWS = 22;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

/* Every character the phone types, with the moment its key goes down. */
const PHONE_KEYS = SCRIPT.flatMap((line) => {
  const typed = line.typed;
  if (!typed || typed.by !== "phone") return [];
  return [...typed.text].map((char, i) => ({ char, at: typed.at + i * typed.rate }));
});

const KEYBOARD_WINDOWS = SCRIPT.flatMap((line) =>
  line.typed?.by === "phone" ? [[line.typed.at - 0.45, typedEnd(line) + 0.35] as const] : [],
);

function keyDown(t: number, char: string): number {
  return PHONE_KEYS.reduce(
    (down, key) => (key.char === char ? Math.max(down, press(t, key.at)) : down),
    0,
  );
}

function Keyboard({ t, width }: { t: number; width: number }) {
  const device = useDevice();
  const shown = KEYBOARD_WINDOWS.reduce(
    (p, [a, b]) => Math.max(p, progress(t, a, 0.3) * (1 - progress(t, b, 0.3))),
    0,
  );
  if (shown <= 0) return null;
  const gap = 4;
  const keyWidth = (width - 12 - gap * 9) / 10;

  const key = (char: string, w: number, label = char) => {
    const down = keyDown(t, char);
    return (
      <span
        key={char}
        style={{
          width: w,
          height: 30,
          borderRadius: 5,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: down > 0 ? device.keyDown : device.key,
          color: down > 0 ? device.ink : device.inkMuted,
          transform: `scale(${mix(1, 1.12, down)})`,
          fontFamily: font.sans,
          fontSize: 12,
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "10px 6px 26px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        background: device.keyboard,
        borderTop: `1px solid ${device.border}`,
        transform: `translateY(${mix(100, 0, shown)}%)`,
      }}
    >
      {KEY_ROWS.map((row) => (
        <div key={row} style={{ display: "flex", gap }}>
          {[...row].map((char) => key(char, keyWidth))}
        </div>
      ))}
      <div style={{ display: "flex", gap }}>{key(" ", keyWidth * 6, "space")}</div>
    </div>
  );
}

function Notification({ t }: { t: number }) {
  const device = useDevice();
  const inAt = T.notify;
  const enter = progress(t, inAt, 0.5);
  const exit = progress(t, T.attentionTap + 0.12, 0.3);
  if (enter <= 0 || exit >= 1) return null;
  const tap = press(t, T.attentionTap);

  return (
    <div
      style={{
        position: "absolute",
        top: 46,
        left: 8,
        right: 8,
        padding: "11px 12px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        borderRadius: 18,
        border: `1px solid ${device.border}`,
        background: device.card,
        opacity: enter * (1 - exit),
        transform: `translateY(${mix(-24, 0, enter) - exit * 24}px) scale(${mix(1, 0.97, tap)})`,
        fontFamily: font.sans,
      }}
    >
      <Mark size={28} tile={device.mark} ink={device.markInk} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: device.ink, fontWeight: 600 }}>Wrapper</span>
          <span style={{ color: device.inkFaint }}>now</span>
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: device.inkMuted, whiteSpace: "nowrap" }}>
          Session {SESSION_TAG} needs you.
        </div>
      </div>
    </div>
  );
}

export function Phone({ t, layout }: { t: number; layout: Layout }) {
  const device = useDevice();
  const { width, height } = layout.phone;
  const screenWidth = width - BEZEL * 2;
  const contentWidth = (screenWidth - SCREEN_PAD * 2) / MIRROR_SCALE;
  const columns = Math.floor(contentWidth / (TERMINAL.fontSize * MONO_ADVANCE));

  const live = liveness(t);
  const mirror = progress(t, T.live + 0.2, 0.5) * (1 - 0.85 * progress(t, T.unshare, 0.5));
  const unshared = progress(t, T.unshare + 0.15, 0.3);
  const badge = progress(t, T.live, 0.4, ease);
  const canType = progress(t, T.guestPress + 0.15, 0.3);
  const notified = progress(t, T.notify, 0.25) * (1 - progress(t, T.attentionTap + 0.3, 0.3));

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: 46,
        border: `1px solid ${device.border}`,
        background: device.body,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: BEZEL,
          borderRadius: 36,
          background: device.terminal,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 58,
            left: SCREEN_PAD,
            right: SCREEN_PAD,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: font.sans,
            fontSize: 13,
            fontWeight: 590,
            opacity: badge * (1 - notified),
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                background: interpolateColors(live, [0, 1], [device.inkFaint, device.live]),
              }}
            />
            <span style={{ position: "relative", color: device.inkMuted }}>
              <span style={{ color: device.live, opacity: 1 - unshared }}>Live</span>
              <span style={{ position: "absolute", left: 0, whiteSpace: "pre", opacity: unshared }}>
                Not shared
              </span>
            </span>
          </span>
          <span
            style={{
              position: "relative",
              padding: "3px 9px",
              borderRadius: 999,
              border: `1px solid ${device.border}`,
              fontSize: 11,
              fontWeight: 510,
              color: device.inkMuted,
              whiteSpace: "pre",
              opacity: 1 - unshared,
            }}
          >
            <span style={{ opacity: 1 - canType }}>Watch only</span>
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                textAlign: "center",
                color: device.ink,
                opacity: canType,
              }}
            >
              Can type
            </span>
          </span>
        </div>

        <div
          style={{
            position: "absolute",
            top: MIRROR_TOP,
            left: SCREEN_PAD,
            width: contentWidth,
            transformOrigin: "0 0",
            transform: `scale(${MIRROR_SCALE}) translateY(${mix(10, 0, mirror)}px)`,
            opacity: mirror,
          }}
        >
          <TerminalScreen t={t} rows={MIRROR_ROWS} columns={columns} />
        </div>

        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            width: 84,
            height: 24,
            marginLeft: -42,
            borderRadius: 12,
            background: device.island,
          }}
        />

        <Notification t={t} />
        <Keyboard t={t} width={screenWidth} />

        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            width: 96,
            height: 5,
            marginLeft: -48,
            borderRadius: 3,
            background: device.border,
          }}
        />
      </div>
    </div>
  );
}
