import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

export const alt = "Wrapper. Your terminal, wherever you are.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  overflow: "hidden",
  padding: "58px 68px",
  background: "#f6f6f2",
  color: "#121316",
  fontFamily: "Arial, sans-serif",
};

const brandRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 16 };
const brandNameStyle: CSSProperties = {
  display: "flex",
  fontSize: 24,
  fontWeight: 600,
  letterSpacing: "-0.04em",
};
const markStyle: CSSProperties = {
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  background: "#121316",
  color: "#f8f8f4",
  fontSize: 24,
  fontWeight: 700,
};
const headlineStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxWidth: 820,
  fontSize: 68,
  fontWeight: 600,
  lineHeight: 0.96,
  letterSpacing: "-0.055em",
};
const factsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const pillStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  borderRadius: 172,
  background: "#356de8",
  color: "#fff",
  fontSize: 18,
  fontWeight: 500,
};
const mutedStyle: CSSProperties = {
  color: "#62666e",
  fontSize: 20,
  lineHeight: 1.3,
  maxWidth: 420,
};

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={rootStyle}>
      <div style={brandRowStyle}>
        <div style={markStyle}>W</div>
        <div style={brandNameStyle}>Wrapper</div>
      </div>

      <div style={columnStyle}>
        <div style={headlineStyle}>Your terminal, still running. Wherever you are.</div>
        <div style={mutedStyle}>
          Keep your shell on your machine. Share it with another device only when you choose.
        </div>
      </div>

      <div style={factsStyle}>
        <div style={pillStyle}>Install Wrapper</div>
      </div>
    </div>,
    size,
  );
}
