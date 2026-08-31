import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { formatPrefixLabel, parsePrefix, resolvePrefix } from "../util/prefix-config";
import { isHttpUrl } from "../util/open-url";

describe("prefix parsing", () => {
  test("parses the default Ctrl+\\ encodings", () => {
    expect(parsePrefix("ctrl+\\")).toBe(0x1c);
    expect(parsePrefix("Ctrl+\\\\")).toBe(0x1c);
    expect(parsePrefix("0x1c")).toBe(0x1c);
    expect(parsePrefix("^\\")).toBe(0x1c);
  });

  test("parses letter prefixes", () => {
    expect(parsePrefix("ctrl+g")).toBe(0x07);
    expect(parsePrefix("CTRL+G")).toBe(0x07);
    expect(parsePrefix("^G")).toBe(0x07);
  });

  test("rejects interrupt and editing controls", () => {
    expect(parsePrefix("ctrl+c")).toBeNull();
    expect(parsePrefix("ctrl+d")).toBeNull();
    expect(parsePrefix("ctrl+z")).toBeNull();
    expect(parsePrefix("0x03")).toBeNull();
    expect(parsePrefix("")).toBeNull();
  });

  test("formats known prefix bytes", () => {
    expect(formatPrefixLabel(0x1c)).toBe("Ctrl+\\");
    expect(formatPrefixLabel(0x07)).toBe("Ctrl+G");
  });
});

describe("prefix resolution", () => {
  test("prefers WRAPPER_PREFIX over config.json", () => {
    const directory = mkdtempSync(join(tmpdir(), "wrapper-prefix-"));
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "config.json"), `${JSON.stringify({ prefix: "ctrl+g" })}\n`);

    expect(
      resolvePrefix({
        env: { WRAPPER_PREFIX: "ctrl+\\" },
        configDir: directory,
      }),
    ).toMatchObject({ byte: 0x1c, source: "env" });
  });

  test("reads prefix from config.json when env is unset", () => {
    const directory = mkdtempSync(join(tmpdir(), "wrapper-prefix-"));
    writeFileSync(join(directory, "config.json"), `${JSON.stringify({ prefix: "ctrl+g" })}\n`);

    expect(resolvePrefix({ env: {}, configDir: directory })).toMatchObject({
      byte: 0x07,
      label: "Ctrl+G",
      source: "config",
    });
  });

  test("falls back to Ctrl+\\ for invalid values", () => {
    const directory = mkdtempSync(join(tmpdir(), "wrapper-prefix-"));
    writeFileSync(join(directory, "config.json"), `${JSON.stringify({ prefix: "ctrl+c" })}\n`);

    expect(
      resolvePrefix({
        env: { WRAPPER_PREFIX: "nope" },
        configDir: directory,
      }),
    ).toMatchObject({ byte: 0x1c, source: "default" });
  });
});

describe("browser URL guard", () => {
  test("accepts only http(s) URLs", () => {
    expect(isHttpUrl("https://www.wrapper.sh/oauth/authorize?user_code=ABCD")).toBe(true);
    expect(isHttpUrl("http://localhost:3000/oauth/authorize")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });
});
