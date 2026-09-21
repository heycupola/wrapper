import { describe, expect, test } from "bun:test";
import {
  WORDMARK_ROWS,
  formatShareCode,
  heading,
  renderBanner,
  renderWelcome,
  renderWordmark,
} from "../util/ui";

// Colour codes are ESC [ ... m; the string form keeps oxlint's control-regex rule quiet.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

describe("wordmark", () => {
  test("every row has the same width so the gradient lines up", () => {
    const widths = new Set(WORDMARK_ROWS.map((row) => row.length));
    expect(widths.size).toBe(1);
  });

  test("renders five rows with the requested indent", () => {
    const rows = renderWordmark("--").split("\n");
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row.replace(ANSI, "").startsWith("--")).toBe(true);
  });
});

describe("banner", () => {
  test("shows version and tagline", () => {
    const plain = renderBanner({ version: "1.2.3" }).replace(ANSI, "");
    expect(plain).toContain("v1.2.3");
    expect(plain).toContain("Bring your terminal to your phone");
    expect(plain).not.toContain("prod");
  });

  test("labels non-production environments", () => {
    const plain = renderBanner({ version: "1.2.3", envLabel: "dev" }).replace(ANSI, "");
    expect(plain).toContain("dev");
  });

  test("welcome lists the quick start and telemetry notice", () => {
    const plain = renderWelcome({ version: "0.0.1" }).replace(ANSI, "");
    expect(plain).toContain("Ready to use");
    expect(plain).toContain("wrapper share");
    expect(plain).toContain("wrapper telemetry enable");
  });
});

describe("helpers", () => {
  test("heading carries the command and optional meta", () => {
    const plain = heading("status", "prod").replace(ANSI, "");
    expect(plain).toContain("wrapper status");
    expect(plain).toContain("prod");
  });

  test("formatShareCode groups eight characters and leaves others alone", () => {
    expect(formatShareCode("abcd2345")).toBe("ABCD-2345");
    expect(formatShareCode("ABCD-2345")).toBe("ABCD-2345");
    expect(formatShareCode("short")).toBe("short");
  });
});
