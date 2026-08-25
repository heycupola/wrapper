export const siteUrl =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://www.wrapper.sh");

export const main = {
  backgroundColor: "#F6F6F2",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  padding: "40px 0",
};

export const container = {
  backgroundColor: "#FFFFFF",
  margin: "0 auto",
  maxWidth: "600px",
  border: "1px solid #DCDDDA",
  borderRadius: "14px",
};

export const section = {
  padding: "40px",
};

export const logoImg = {
  width: "40px",
  height: "40px",
  marginBottom: "16px",
  borderRadius: "8px",
};

export const divider = {
  border: "none",
  borderTop: "1px solid #DCDDDA",
  margin: "0 0 24px 0",
};

export const heading = {
  fontSize: "28px",
  fontWeight: "600",
  color: "#121316",
  margin: "0 0 24px 0",
  letterSpacing: "-0.02em",
};

export const subheading = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#121316",
  margin: "24px 0 16px 0",
  fontWeight: "600",
};

export const paragraph = {
  fontSize: "15px",
  lineHeight: "26px",
  color: "#62666E",
  margin: "0 0 16px 0",
};

export const bold = {
  color: "#121316",
  fontWeight: "600" as const,
};

export const block = {
  backgroundColor: "#ECEDE8",
  border: "1px solid #DCDDDA",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

export const listItem = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#62666E",
  margin: "0 0 8px 0",
};

export const listItemLast = {
  ...listItem,
  margin: "0",
};

export const code = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #DCDDDA",
  borderRadius: "8px",
  padding: "2px 6px",
  fontSize: "13px",
  fontFamily: "'Geist Mono', 'SF Mono', Monaco, Consolas, monospace",
  color: "#121316",
};

export const infoBlock = {
  backgroundColor: "#ECEDE8",
  border: "1px solid #DCDDDA",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "24px",
};

export const infoText = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#62666E",
  margin: "0",
};

export const cautionBlock = {
  backgroundColor: "#ECEDE8",
  border: "1px solid #DCDDDA",
  borderLeft: "3px solid #356DE8",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

export const cautionText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#62666E",
  margin: "0",
};

export const warningBlock = {
  backgroundColor: "#ECEDE8",
  border: "1px solid #DCDDDA",
  borderLeft: "3px solid #121316",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

export const button = {
  backgroundColor: "#356DE8",
  border: "none",
  borderRadius: "999px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 28px",
};

export const footer = {
  backgroundColor: "#ECEDE8",
  borderTop: "1px solid #DCDDDA",
  padding: "24px 40px",
  textAlign: "center" as const,
  borderBottomLeftRadius: "14px",
  borderBottomRightRadius: "14px",
};

export const cupolaLogo = {
  height: "16px",
  width: "auto",
  margin: "0 auto 8px",
  display: "block",
  opacity: "0.7",
};

export const footerText = {
  fontSize: "12px",
  color: "#62666E",
  margin: "0",
};
