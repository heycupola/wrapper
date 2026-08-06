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
  background: "#eef0f2",
  color: "#14171c",
  fontFamily: "Arial, sans-serif",
  border: "2px solid #14171c",
};

const brandRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 16 };
const markStyle: CSSProperties = {
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 0,
  background: "#14171c",
  color: "#f8f9fa",
  fontSize: 24,
  fontWeight: 700,
};
const brandNameStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: "-0.04em",
};
const headlineGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const eyebrowStyle: CSSProperties = {
  color: "#666c75",
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};
const headlineStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 76,
  fontWeight: 700,
  lineHeight: 0.95,
  letterSpacing: "-0.065em",
};
const headlineAccentStyle: CSSProperties = {
  color: "#2d57f0",
  fontFamily: "Georgia, serif",
  fontStyle: "italic",
};
const factsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 20,
  color: "#666c75",
  fontSize: 18,
};

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={rootStyle}>
      <div style={brandRowStyle}>
        <div style={markStyle}>W</div>
        <span style={brandNameStyle}>Wrapper</span>
      </div>

      <div style={headlineGroupStyle}>
        <span style={eyebrowStyle}>A live shell, by invitation</span>
        <div style={headlineStyle}>
          <span>Your terminal. Still running.</span>
          <span style={headlineAccentStyle}>Wherever you are.</span>
        </div>
      </div>

      <div style={factsStyle}>
        <span>Local-first</span>
        <span>•</span>
        <span>Authorized sharing</span>
        <span>•</span>
        <span>P2P with relay fallback</span>
      </div>
    </div>,
    size,
  );
}
