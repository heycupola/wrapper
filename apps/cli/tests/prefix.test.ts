import { describe, expect, test } from "bun:test";
import { PrefixFilter, type PrefixCommand } from "../shell/prefix";

const PFX = String.fromCharCode(0x1c); // Ctrl+\
const ESC = "\x1b";

function newFilter(opts?: { armedTimeoutMs?: number }): {
  filter: PrefixFilter;
  events: PrefixCommand[];
  armedHistory: boolean[];
} {
  const events: PrefixCommand[] = [];
  const armedHistory: boolean[] = [];
  const filter = new PrefixFilter({
    onCommand: (c) => events.push(c),
    onArmedChange: (a) => armedHistory.push(a),
    armedTimeoutMs: opts?.armedTimeoutMs ?? 0, // disable timeout for deterministic tests
  });
  return { filter, events, armedHistory };
}

describe("PrefixFilter", () => {
  test("plain bytes pass through", () => {
    const { filter, events } = newFilter();
    expect(filter.process("hello")).toBe("hello");
    expect(events).toEqual([]);
  });

  test("control bytes (Ctrl+C, Ctrl+Z, Ctrl+D) always pass through", () => {
    const { filter, events } = newFilter();
    expect(filter.process("\x03")).toBe("\x03"); // Ctrl+C
    expect(filter.process("\x1a")).toBe("\x1a"); // Ctrl+Z
    expect(filter.process("\x04")).toBe("\x04"); // Ctrl+D
    expect(events).toEqual([]);
  });

  test("PFX + s emits 'share' and swallows both bytes", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}s`)).toBe("");
    expect(events).toEqual(["share"]);
  });

  test("PFX + u emits 'unshare'", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}u`)).toBe("");
    expect(events).toEqual(["unshare"]);
  });

  test("PFX + ? emits 'status'", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}?`)).toBe("");
    expect(events).toEqual(["status"]);
  });

  test("PFX + PFX is a literal escape (no event, byte forwarded)", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}${PFX}`)).toBe(PFX);
    expect(events).toEqual([]);
  });

  test("PFX + ESC silently aborts command mode", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}${ESC}`)).toBe("");
    expect(events).toEqual([]);
  });

  test("PFX + unknown byte forwards BOTH bytes to the shell", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`${PFX}x`)).toBe(`${PFX}x`);
    expect(events).toEqual([]);
  });

  test("prefix split across two chunks still triggers", () => {
    const { filter, events } = newFilter();
    expect(filter.process(PFX)).toBe("");
    expect(events).toEqual([]);
    expect(filter.process("s")).toBe("");
    expect(events).toEqual(["share"]);
  });

  test("non-prefix bytes around an escape sequence are preserved", () => {
    const { filter, events } = newFilter();
    expect(filter.process(`abc${PFX}sdef`)).toBe("abcdef");
    expect(events).toEqual(["share"]);
  });

  test("onArmedChange fires when entering and leaving armed state", () => {
    const { filter, armedHistory } = newFilter();
    filter.process(PFX);
    expect(armedHistory).toEqual([true]);
    filter.process("s");
    expect(armedHistory).toEqual([true, false]);
  });

  test("reset() returns to idle state", () => {
    const { filter, armedHistory } = newFilter();
    filter.process(PFX);
    expect(filter.armed).toBe(true);
    filter.reset();
    expect(filter.armed).toBe(false);
    expect(armedHistory).toEqual([true, false]);
  });

  test("auto-timeout disarms after the configured delay", async () => {
    const { filter, armedHistory } = newFilter({ armedTimeoutMs: 50 });
    filter.process(PFX);
    expect(filter.armed).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(filter.armed).toBe(false);
    expect(armedHistory).toEqual([true, false]);
  });

  test("honours a custom prefix byte", () => {
    const events: PrefixCommand[] = [];
    const filter = new PrefixFilter({
      prefix: 0x07,
      onCommand: (c) => events.push(c),
      armedTimeoutMs: 0,
    });
    expect(filter.process(`\x07s`)).toBe("");
    expect(events).toEqual(["share"]);
  });

  test("auto-timeout re-emits the prefix byte instead of dropping it", async () => {
    const forwarded: string[] = [];
    const filter = new PrefixFilter({
      onCommand: () => {},
      onForward: (data) => forwarded.push(data),
      armedTimeoutMs: 50,
    });
    expect(filter.process(PFX)).toBe("");
    expect(forwarded).toEqual([]);
    await new Promise((r) => setTimeout(r, 100));
    expect(filter.armed).toBe(false);
    expect(forwarded).toEqual([PFX]);
  });
});
