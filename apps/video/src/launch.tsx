import { CameraMotionBlur } from "@remotion/motion-blur";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing } from "remotion";
import { EndCard } from "./components/end-card";
import { Headlines } from "./components/headlines";
import { KeyHint } from "./components/key-hint";
import { Link } from "./components/link";
import { Phone } from "./components/phone";
import { COMMAND } from "./components/terminal-screen";
import { TerminalWindow } from "./components/terminal-window";
import { MONO_ADVANCE, TERMINAL, linkEnds, useLayout, type Layout, type Point } from "./layout";
import { Soundtrack } from "./soundtrack";
import {
  DimensionProvider,
  ThemeProvider,
  useDimension,
  usePalette,
  type Dimension,
  type ThemeName,
} from "./theme";
import { DURATION_SECONDS, T, easeInOut, mix, progress, useTime } from "./timing";

const PERSPECTIVE = 2400;
const DEPTH = { terminal: 0, link: 40, phone: 90, keys: 150 } as const;

/* A camera pose: where it looks (stage px), how close, and its tilt/orbit in degrees. */
type Shot = {
  at: number;
  duration: number;
  x: number;
  y: number;
  scale: number;
  tilt: number;
  orbit: number;
};

function lerp(a: Point, b: Point, p: number): Point {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) };
}

/* Camera moves; each one eases from wherever the last one left off. */
function shots(layout: Layout, dimension: Dimension): Shot[] {
  const { terminal, phone, solo, split, vertical } = layout;
  const commandWidth = (COMMAND.length + 2) * TERMINAL.fontSize * MONO_ADVANCE;
  const middle = vertical
    ? {
        x: split.phone.x,
        y: (split.terminal.y - terminal.height / 2 + split.phone.y + phone.height / 2) / 2,
      }
    : {
        x: (split.terminal.x - terminal.width / 2 + split.phone.x + phone.width / 2) / 2,
        y: split.phone.y,
      };
  /*
   * Close-up on the notification. Landscape frames the phone left of centre, leaving the right
   * half for the headline; vertical centres it below the headline.
   */
  const phoneFocus = {
    x: split.phone.x + layout.closeUp.offset.x,
    y: split.phone.y + layout.closeUp.offset.y,
  };
  const command = {
    x: solo.x - terminal.width / 2 + TERMINAL.padX + commandWidth / 2,
    y: solo.y - terminal.height / 2 + TERMINAL.titleBar + TERMINAL.padTop + TERMINAL.lineHeight / 2,
  };
  /* Flat films keep framing only. Vertical frames orbit less: the devices are stacked. */
  const a = dimension === "2d" ? 0 : 1;
  const o = vertical ? 0.5 : 1;

  const shot = (at: number, duration: number, pose: Omit<Shot, "at" | "duration">): Shot => ({
    at,
    duration,
    ...pose,
    tilt: pose.tilt * a,
    orbit: pose.orbit * a * o,
  });

  /* Each move lands before its headline arrives, so the frame holds while it is read. */
  return [
    shot(0, 0, { ...command, scale: 2.0, tilt: 0, orbit: 0 }),
    shot(0, T.typeStart, { ...command, scale: 2.4, tilt: 0, orbit: 0 }),
    shot(T.pullOut, 2.1, { x: middle.x, y: middle.y, scale: 0.97, tilt: 6, orbit: 7 }),
    shot(T.relay - 0.2, 1.3, { x: middle.x, y: middle.y - 50, scale: 0.98, tilt: 11, orbit: -4 }),
    shot(T.guestKey - 0.2, 1.3, { x: middle.x, y: middle.y, scale: 1.03, tilt: 4, orbit: 8 }),
    shot(T.attention - 0.2, 1.4, {
      ...phoneFocus,
      scale: layout.closeUp.scale,
      tilt: 2,
      orbit: -5,
    }),
    shot(T.closeUpEnd, 1.0, { x: middle.x, y: middle.y, scale: 1, tilt: 7, orbit: 5 }),
    shot(T.regroup + 0.1, 1.0, { x: solo.x, y: solo.y + 20, scale: 1.06, tilt: 6, orbit: -10 }),
    shot(T.worksWith + 1.2, T.outro - T.worksWith - 1.2, {
      x: solo.x,
      y: solo.y + 20,
      scale: 1.09,
      tilt: 5,
      orbit: -6,
    }),
  ];
}

const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

/*
 * Chapter transitions applied to the whole stage: a focus pull on the open, a push-through
 * that hides the cut from sharing to `wrapper run`, and a push into the end card.
 */
function transition(t: number) {
  const open = progress(t, 0, 1.0);
  const surge = progress(t, T.regroup - 0.2, 0.4, easeIn) * (1 - progress(t, T.regroup + 0.2, 0.8));
  const close = progress(t, T.outro, 0.7, easeIn);
  return {
    scale: mix(1.06, 1, open) * (1 + 0.1 * surge) * (1 + 0.22 * close),
    blur: 16 * (1 - open) + 7 * surge + 18 * close,
    opacity: open * (1 - close),
    done: close >= 1,
  };
}

function camera(t: number, moves: Shot[]): Shot {
  const [first, ...rest] = moves;
  if (!first) return { at: 0, duration: 0, x: 0, y: 0, scale: 1, tilt: 0, orbit: 0 };
  return rest.reduce((current, move) => {
    const p = progress(t, move.at, move.duration, easeInOut);
    return {
      ...current,
      x: mix(current.x, move.x, p),
      y: mix(current.y, move.y, p),
      scale: mix(current.scale, move.scale, p),
      tilt: mix(current.tilt, move.tilt, p),
      orbit: mix(current.orbit, move.orbit, p),
    };
  }, first);
}

function Place({
  at,
  z,
  width,
  height,
  style,
  children,
}: {
  at: Point;
  z: number;
  width: number;
  height: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: at.x - width / 2,
        top: at.y - height / 2,
        width,
        height,
        transformStyle: "preserve-3d",
        ...style,
        transform: `translateZ(${z}px) ${style?.transform ?? ""}`,
      }}
    >
      {children}
    </div>
  );
}

function Stage({ t }: { t: number }) {
  const color = usePalette();
  const layout = useLayout();
  const { terminal, phone, solo, split } = layout;

  const toSplit = progress(t, T.split, 1.0, easeInOut);
  const toSolo = progress(t, T.regroup, 1.0, easeInOut);
  const terminalAt = lerp(lerp(solo, split.terminal, toSplit), solo, toSolo);

  const phoneIn = progress(t, T.split + 0.25, 0.9);
  const phoneOut = progress(t, T.regroup, 0.5);
  const drift = 48 * (1 - phoneIn) + 24 * phoneOut;
  const phoneAt = layout.vertical
    ? { x: split.phone.x, y: split.phone.y + drift }
    : { x: split.phone.x + drift, y: split.phone.y };

  const dimension = useDimension();
  const flat = dimension === "2d";
  const view = camera(t, shots(layout, dimension));
  const chrome = progress(t, T.pullOut + 0.25, 1.0);
  const fx = transition(t);
  /* During the phone close-up the link steps back so only the phone holds focus. */
  const focus = progress(t, T.attention - 0.2, 0.8) * (1 - progress(t, T.closeUpEnd, 0.8));
  const elevation = flat
    ? undefined
    : `0 50px 90px -30px ${color.shadow}, 0 18px 36px -18px ${color.shadow}`;

  const ends = linkEnds(layout);
  const middle = lerp(ends.from, ends.to, 0.5);

  if (fx.done) return null;

  return (
    <AbsoluteFill
      style={{
        perspective: flat ? undefined : PERSPECTIVE,
        perspectiveOrigin: "50% 45%",
        filter: fx.blur > 0.05 ? `blur(${fx.blur}px)` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformStyle: "preserve-3d",
          opacity: fx.opacity,
          transform: `scale(${fx.scale})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            transformStyle: "preserve-3d",
            transform: `scale(${view.scale}) rotateX(${view.tilt}deg) rotateY(${view.orbit}deg) translate(${-view.x}px, ${-view.y}px)`,
          }}
        >
          {phoneIn > 0 && phoneOut < 1 ? (
            <>
              <div
                style={{
                  position: "absolute",
                  transformStyle: "preserve-3d",
                  transform: `translateZ(${DEPTH.link}px)`,
                }}
              >
                <Link
                  t={t}
                  from={ends.from}
                  to={ends.to}
                  relayOffset={layout.relay}
                  chipOffset={layout.chip}
                  fade={(1 - phoneOut) * (1 - focus)}
                />
              </div>
              <Place
                at={phoneAt}
                z={DEPTH.phone}
                width={phone.width}
                height={phone.height}
                style={{
                  opacity: phoneIn * (1 - phoneOut),
                  transform: `scale(${mix(0.96, 1, phoneIn)})`,
                  borderRadius: 46,
                  boxShadow: elevation,
                }}
              >
                <Phone t={t} layout={layout} />
              </Place>
            </>
          ) : null}
          <Place
            at={terminalAt}
            z={DEPTH.terminal}
            width={terminal.width}
            height={terminal.height}
            style={{ borderRadius: 14, boxShadow: chrome > 0 ? elevation : undefined }}
          >
            <TerminalWindow t={t} layout={layout} chrome={chrome} />
          </Place>
          <div
            style={{
              position: "absolute",
              left: middle.x,
              top: middle.y,
              transform: `translateZ(${DEPTH.keys}px)`,
            }}
          >
            <KeyHint t={t} keyLabel="w" showAt={T.guestKey} pressAt={T.guestPress} />
            <KeyHint t={t} keyLabel="u" showAt={T.unshareKey} pressAt={T.unsharePress} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Film({ blur }: { blur: boolean }) {
  const t = useTime();
  const color = usePalette();
  const layout = useLayout();
  const push = mix(1, 1.03, t / DURATION_SECONDS);

  const scene = (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <SceneLayers />
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: color.canvas, overflow: "hidden" }}>
      <Soundtrack />
      {blur ? (
        <CameraMotionBlur shutterAngle={180} samples={6}>
          {scene}
        </CameraMotionBlur>
      ) : (
        scene
      )}
      {t >= T.mark ? (
        <AbsoluteFill style={{ transform: `scale(${push})` }}>
          <EndCard t={t} layout={layout} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

/* Everything that moves with the camera, re-rendered per motion-blur sample. */
function SceneLayers() {
  const t = useTime();
  const layout = useLayout();
  return (
    <>
      <Stage t={t} />
      <Headlines t={t} layout={layout} />
    </>
  );
}

export type LaunchProps = { theme: ThemeName; dimension: Dimension; motionBlur: boolean };

export function Launch({ theme, dimension, motionBlur }: LaunchProps) {
  return (
    <ThemeProvider value={theme}>
      <DimensionProvider value={dimension}>
        <Film blur={motionBlur} />
      </DimensionProvider>
    </ThemeProvider>
  );
}
