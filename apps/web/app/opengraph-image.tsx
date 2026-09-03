import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactNode } from "react";

/**
 * Social preview. It is the dark half of the brand system on purpose: link
 * previews sit inside white/light chrome on X, Slack, iMessage and LinkedIn,
 * so a dark canvas reads as a product card rather than another block of the
 * host page. Everything here is a flat fill (see BRAND.md) and the terminal
 * copy mirrors the interactive hero (`components/hero-demo`).
 */

export const alt = "Wrapper. Your terminal, still running. Wherever you are.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Dark theme tokens from globals.css.
const CANVAS = "#0d0f12";
const SURFACE = "#15181d";
const SURFACE_MUTED = "#1c2026";
const BORDER = "#2b3038";
const INK = "#f6f7f9";
const INK_MUTED = "#a8adb5";
const ACTION_BLUE = "#356de8";
const LIVE_BLUE = "#7aa7ff";
const SUCCESS = "#72cf98";
// Terminal palette from hero-demo.css (`.iosTerminalBody`).
const TERMINAL_TEXT = "#f5f7fa";
const TERMINAL_TAG = "#5fd3e0";

// Mirrors `hero-demo/demo-session.ts` so the preview shows the real product.
const SESSION_TAG = "4J8K2P";
const SESSION_ID = "4J8K2PQ7M3XW";
const SHARE_CODE = "7N4K-WQ2M";
const CWD = "~/projects/api";

const SANS = "Geist";
const MONO = "Geist Mono";

const root: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  overflow: "hidden",
  background: CANVAS,
  color: INK,
  fontFamily: SANS,
};

const copyColumn: CSSProperties = {
  position: "absolute",
  top: 60,
  left: 64,
  bottom: 60,
  width: 560,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const brandName: CSSProperties = {
  display: "flex",
  fontSize: 26,
  fontWeight: 600,
  letterSpacing: "-0.03em",
  color: INK,
};

const headline: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 68,
  fontWeight: 600,
  lineHeight: 0.98,
  letterSpacing: "-0.05em",
  color: INK,
};

// Satori stretches the inter-word gap on tightly tracked lines; laying the
// words out as flex items keeps the space the same width as the other lines.
const headlineRow: CSSProperties = { display: "flex", gap: 10 };

const lead: CSSProperties = {
  display: "flex",
  marginTop: 26,
  maxWidth: 500,
  fontSize: 22,
  fontWeight: 400,
  lineHeight: 1.4,
  color: INK_MUTED,
};

const footerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 22,
};

const pill: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 52,
  padding: "0 24px",
  borderRadius: 999,
  background: ACTION_BLUE,
  color: "#ffffff",
  fontSize: 19,
  fontWeight: 600,
  letterSpacing: "-0.01em",
};

const footerMeta: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontFamily: MONO,
  fontSize: 16,
  color: INK_MUTED,
};

const footerDot: CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: 2,
  background: BORDER,
};

// The window overshoots the right and bottom edges so the card feels like a
// crop of a running desktop rather than a framed illustration. Chrome that
// has to stay legible (title, live chip) is laid out against the visible part.
const BLEED = 68;
const WINDOW_LEFT = 668;
const terminalWindow: CSSProperties = {
  position: "absolute",
  top: 98,
  left: WINDOW_LEFT,
  width: size.width - WINDOW_LEFT + BLEED,
  height: 600,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 14,
  border: `1px solid ${BORDER}`,
  background: SURFACE,
  boxShadow: "0 40px 90px -30px rgba(0, 0, 0, 0.8)",
};

const titlebar: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  height: 46,
  padding: "0 18px",
  borderBottom: `1px solid ${BORDER}`,
  background: SURFACE_MUTED,
};

const traffic: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const trafficLight = (fill: string): CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: 6,
  background: fill,
});

const windowTitle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: BLEED,
  top: 0,
  bottom: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: MONO,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0.01em",
  color: INK_MUTED,
};

const liveChip: CSSProperties = {
  position: "absolute",
  right: BLEED + 16,
  top: 11,
  display: "flex",
  alignItems: "center",
  gap: 7,
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  background: SURFACE,
  fontFamily: MONO,
  fontSize: 12,
  fontWeight: 600,
  color: LIVE_BLUE,
};

const liveDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 4,
  background: LIVE_BLUE,
};

const scrollback: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "22px 24px",
  fontFamily: MONO,
  fontSize: 15.5,
  lineHeight: 1.6,
  color: TERMINAL_TEXT,
};

const line: CSSProperties = {
  display: "flex",
  alignItems: "center",
  whiteSpace: "pre",
};

const MUTED_TEXT = "#8a9099";
const mutedLine: CSSProperties = { ...line, color: MUTED_TEXT };
const blankLine: CSSProperties = { ...line, height: 12 };
const tagText: CSSProperties = { flexShrink: 0, color: TERMINAL_TAG };
const cwdText: CSSProperties = { flexShrink: 0, color: LIVE_BLUE, fontWeight: 600 };
const indentText: CSSProperties = { paddingLeft: 24 };
const mutedText: CSSProperties = { color: MUTED_TEXT };
const liveText: CSSProperties = { color: LIVE_BLUE, fontWeight: 600 };
const column: CSSProperties = { display: "flex", flexDirection: "column" };
const cursorSlot: CSSProperties = { display: "flex", alignItems: "center" };
const chevronIcon: CSSProperties = { margin: "0 8px 0 6px" };
const checkIcon: CSSProperties = { marginRight: 8 };
const shareCode: CSSProperties = {
  display: "flex",
  padding: "0 8px",
  marginLeft: 2,
  borderRadius: 6,
  background: "rgba(122, 167, 255, 0.14)",
  color: LIVE_BLUE,
  fontWeight: 600,
};
const cursor: CSSProperties = {
  width: 9,
  height: 20,
  marginLeft: 2,
  background: TERMINAL_TEXT,
};

function Mark() {
  // The real brand mark (public/wrapper-icon-dark.svg), light square on the
  // dark canvas exactly as the site header renders it in dark mode.
  return (
    <svg width="44" height="44" viewBox="0 0 96 96" fill="none">
      <rect width="96" height="96" rx="20" fill="#fafaf9" />
      <path
        d="M30.52 64L25 32H31.7686L35.8429 59.5213H36.8943L42.5457 32H53.52L59.1057 59.5213H60.1571L64.2314 32H71L65.48 64H54.1114L48.5257 36.5436H47.4743L41.8886 64H30.52Z"
        fill="#0e0e0e"
      />
    </svg>
  );
}

function Chevron() {
  // Drawn instead of typed so the prompt never depends on a glyph the loaded
  // font may not carry.
  return (
    <svg width="11" height="18" viewBox="0 0 11 18" fill="none" style={chevronIcon}>
      <path
        d="M2.5 3.5L8 9L2.5 14.5"
        stroke={SUCCESS}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={checkIcon}>
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke={SUCCESS}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Prompt({ children }: { children: ReactNode }) {
  return (
    <div style={line}>
      <span style={cwdText}>{CWD}</span>
      <Chevron />
      <span>{children}</span>
    </div>
  );
}

function Wrapper({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <div style={muted ? mutedLine : line}>
      <span style={tagText}>[wrapper]</span>
      <span> </span>
      {children}
    </div>
  );
}

function Output({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <div style={muted ? mutedLine : line}>{children}</div>;
}

async function loadFonts() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [sansRegular, sansSemiBold, monoRegular, monoSemiBold] = await Promise.all([
    readFile(join(dir, "Geist-Regular.ttf")),
    readFile(join(dir, "Geist-SemiBold.ttf")),
    readFile(join(dir, "GeistMono-Regular.ttf")),
    readFile(join(dir, "GeistMono-SemiBold.ttf")),
  ]);
  return [
    { name: SANS, data: sansRegular, weight: 400 as const, style: "normal" as const },
    { name: SANS, data: sansSemiBold, weight: 600 as const, style: "normal" as const },
    { name: MONO, data: monoRegular, weight: 400 as const, style: "normal" as const },
    { name: MONO, data: monoSemiBold, weight: 600 as const, style: "normal" as const },
  ];
}

export default async function OpenGraphImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div style={root}>
      <div style={copyColumn}>
        <div style={brandRow}>
          <Mark />
          <div style={brandName}>Wrapper</div>
        </div>

        <div style={column}>
          <div style={headline}>
            <div style={headlineRow}>
              <span>Your</span>
              <span>terminal,</span>
            </div>
            <div style={headlineRow}>
              <span>still</span>
              <span>running.</span>
            </div>
            <div style={headlineRow}>
              <span>Wherever</span>
              <span>you</span>
              <span>are.</span>
            </div>
          </div>
          <div style={lead}>
            Keep your real shell on your machine. Reach it from another device only when you share
            it.
          </div>
        </div>

        <div style={footerRow}>
          <div style={pill}>Install Wrapper</div>
          <div style={footerMeta}>
            <span>wrapper.sh</span>
            <div style={footerDot} />
            <span>macOS · Linux · iOS</span>
          </div>
        </div>
      </div>

      <div style={terminalWindow}>
        <div style={titlebar}>
          <div style={traffic}>
            <div style={trafficLight("#ff5f57")} />
            <div style={trafficLight("#febc2e")} />
            <div style={trafficLight("#28c840")} />
          </div>
          <div style={windowTitle}>wrapper · host · {SESSION_TAG}</div>
          <div style={liveChip}>
            <div style={liveDot} />
            <span>p2p x1</span>
          </div>
        </div>

        <div style={scrollback}>
          <Wrapper muted>Ctrl+\ then s share | u unshare | ? status</Wrapper>
          <Prompt>git status</Prompt>
          <Output>On branch main</Output>
          <Output muted>Your branch is up to date with 'origin/main'.</Output>
          <div style={blankLine} />
          <Prompt>bun test</Prompt>
          <Output>
            <Check />
            <span>4 pass</span>
            <span style={mutedText}>{"  0 fail  [38.00ms]"}</span>
          </Output>
          <div style={blankLine} />
          <Wrapper>sharing…</Wrapper>
          <Wrapper>session shared via relay</Wrapper>
          <Wrapper>
            <span>share code: </span>
            <span style={shareCode}>{SHARE_CODE}</span>
          </Wrapper>
          <Wrapper muted>others join with:</Wrapper>
          <Output muted>
            <span style={indentText}>wrapper attach --relay --id {SESSION_ID}</span>
          </Output>
          <Wrapper>
            <span>viewer attached · iPhone · </span>
            <span style={liveText}>p2p</span>
          </Wrapper>
          <div style={blankLine} />
          <Prompt>
            <span style={cursorSlot}>
              <div style={cursor} />
            </span>
          </Prompt>
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
