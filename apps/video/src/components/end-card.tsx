import { AbsoluteFill, Easing, Img, staticFile } from "remotion";
import type { Layout } from "../layout";
import { font, useDimension, usePalette, useTheme } from "../theme";
import { T, mix, progress } from "../timing";
import { Mark } from "./mark";
import { Mark3D } from "./mark-3d";
import { Cursor } from "./terminal-screen";

const MARK_CANVAS = 440;
const MARK_FLAT = 150;
/* Cupola's logo artwork is 529×128. */
const CUPOLA_HEIGHT = 80;
const CUPOLA_WIDTH = (CUPOLA_HEIGHT * 529) / 128;

const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

function FlatMark({ t }: { t: number }) {
  const color = usePalette();
  const p = progress(t, T.mark, 1.0);
  return (
    <div
      style={{
        opacity: p,
        transform: `scale(${mix(0.86, 1, p)})`,
        filter: `blur(${(1 - p) * 12}px)`,
      }}
    >
      <Mark size={MARK_FLAT} tile={color.mark} ink={color.markInk} />
    </div>
  );
}

function reveal(t: number, start: number, rise = 14) {
  const p = progress(t, start, 0.8);
  return {
    opacity: p,
    transform: `translateY(${mix(rise, 0, p)}px)`,
    filter: `blur(${(1 - p) * 8}px)`,
  };
}

function WrapperLockup({ t }: { t: number }) {
  const color = usePalette();
  const flat = useDimension() === "2d";

  return (
    <>
      {flat ? (
        <div style={{ margin: "14px 0" }}>
          <FlatMark t={t} />
        </div>
      ) : (
        <div style={{ margin: `${-MARK_CANVAS * 0.3}px 0` }}>
          <Mark3D size={MARK_CANVAS} />
        </div>
      )}
      <div
        style={{
          ...reveal(t, T.wordmark),
          marginTop: 20,
          fontFamily: font.sans,
          fontSize: 68,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: color.ink,
        }}
      >
        Wrapper
      </div>
      <div
        style={{
          ...reveal(t, T.url, 10),
          marginTop: 30,
          fontFamily: font.mono,
          fontSize: 22,
          color: color.inkMuted,
        }}
      >
        <span style={{ position: "relative" }}>
          wrapper.sh
          <span style={{ position: "absolute", left: "100%", marginLeft: "0.5em" }}>
            <Cursor t={t - T.url} color={color.inkMuted} />
          </span>
        </span>
      </div>
    </>
  );
}

function CupolaLogo({ t }: { t: number }) {
  const theme = useTheme();
  /* The web app names artwork by the ink it carries: cupola-dark is for light canvases. */
  const artwork = theme === "light" ? "brand/cupola-dark.svg" : "brand/cupola-light.svg";
  const p = progress(t, T.cupola, 1.1);

  return (
    <Img
      src={staticFile(artwork)}
      alt="Cupola"
      style={{
        width: CUPOLA_WIDTH,
        height: CUPOLA_HEIGHT,
        opacity: p,
        transform: `scale(${mix(1.08, 1, p)})`,
        filter: `blur(${(1 - p) * 14}px)`,
      }}
    />
  );
}

/* Wrapper's lockup lands, holds, then hands the frame to the parent company, Cupola. */
export function EndCard({ t, layout }: { t: number; layout: Layout }) {
  const handoff = progress(t, T.handoff, 0.6, easeIn);
  const centred = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return (
    <AbsoluteFill style={{ ...centred, transform: `scale(${layout.endScale})` }}>
      {handoff < 1 ? (
        <AbsoluteFill
          style={{
            ...centred,
            opacity: 1 - handoff,
            transform: `translateY(${-12 * handoff}px) scale(${mix(1, 0.94, handoff)})`,
            filter: handoff > 0 ? `blur(${handoff * 14}px)` : undefined,
          }}
        >
          <WrapperLockup t={t} />
        </AbsoluteFill>
      ) : null}
      {t >= T.cupola ? (
        <AbsoluteFill style={centred}>
          <CupolaLogo t={t} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
