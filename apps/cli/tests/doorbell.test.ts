import { describe, expect, test } from "bun:test";
import { createDoorbellParser, scanDoorbell } from "../shell/doorbell";

describe("doorbell scanner", () => {
  test("treats a lone BEL as a doorbell", () => {
    const parser = createDoorbellParser();
    expect(scanDoorbell("\x07", parser)).toBe(true);
  });

  test("ignores OSC window titles terminated by BEL", () => {
    const parser = createDoorbellParser();
    expect(scanDoorbell("\x1b]0;~/src\x07", parser)).toBe(false);
    expect(scanDoorbell("\x07", parser)).toBe(true);
  });

  test("ignores OSC titles split across chunks", () => {
    const parser = createDoorbellParser();
    expect(scanDoorbell("\x1b]0;starship", parser)).toBe(false);
    expect(scanDoorbell(" title\x07", parser)).toBe(false);
  });

  test("ignores OSC titles terminated by ST", () => {
    const parser = createDoorbellParser();
    expect(scanDoorbell("\x1b]0;~/src\x1b\\hello", parser)).toBe(false);
  });

  test("still rings when a real BEL follows a title", () => {
    const parser = createDoorbellParser();
    expect(scanDoorbell("\x1b]0;~/src\x07\x07", parser)).toBe(true);
  });
});
