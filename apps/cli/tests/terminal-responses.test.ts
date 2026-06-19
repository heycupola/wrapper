import { describe, expect, test } from "bun:test";
import { stripTerminalResponses } from "../shell/terminal-responses";

const ESC = "\x1b";
const BEL = "\x07";

describe("stripTerminalResponses", () => {
  test("plain text passes through unchanged", () => {
    expect(stripTerminalResponses("hello world")).toBe("hello world");
  });

  test("control bytes (Ctrl+C, Ctrl+Z, Ctrl+D, Ctrl+\\) pass through", () => {
    expect(stripTerminalResponses("\x03\x1a\x04\x1c")).toBe("\x03\x1a\x04\x1c");
  });

  test("standalone Esc is preserved (legitimate user keypress)", () => {
    expect(stripTerminalResponses(ESC)).toBe(ESC);
  });

  test("arrow keys are preserved", () => {
    // Up arrow = ESC [ A — final 'A' is not in the response set
    expect(stripTerminalResponses(`${ESC}[A`)).toBe(`${ESC}[A`);
    expect(stripTerminalResponses(`${ESC}[B`)).toBe(`${ESC}[B`);
    expect(stripTerminalResponses(`${ESC}[C`)).toBe(`${ESC}[C`);
    expect(stripTerminalResponses(`${ESC}[D`)).toBe(`${ESC}[D`);
  });

  test("function keys (~ terminator) are preserved", () => {
    // F5 = ESC [ 1 5 ~
    expect(stripTerminalResponses(`${ESC}[15~`)).toBe(`${ESC}[15~`);
  });

  test("strips primary Device Attributes response", () => {
    // ESC [ ? 1 ; 2 ; 4 c
    expect(stripTerminalResponses(`${ESC}[?1;2;4c`)).toBe("");
  });

  test("strips secondary Device Attributes response", () => {
    // ESC [ > 0 ; 2 7 6 ; 0 c
    expect(stripTerminalResponses(`${ESC}[>0;276;0c`)).toBe("");
  });

  test("strips Cursor Position Report", () => {
    // ESC [ 24 ; 80 R
    expect(stripTerminalResponses(`${ESC}[24;80R`)).toBe("");
  });

  test("strips Device Status Report", () => {
    // ESC [ ? 1 0 ; 0 n
    expect(stripTerminalResponses(`${ESC}[?10;0n`)).toBe("");
  });

  test("strips focus-in / focus-out events", () => {
    expect(stripTerminalResponses(`${ESC}[I`)).toBe("");
    expect(stripTerminalResponses(`${ESC}[O`)).toBe("");
  });

  test("strips OSC colour query response (BEL terminator)", () => {
    expect(stripTerminalResponses(`${ESC}]11;rgb:1e1e/1e1e/2e2e${BEL}`)).toBe("");
  });

  test("strips OSC response with ST terminator", () => {
    expect(stripTerminalResponses(`${ESC}]10;rgb:ffff/ffff/ffff${ESC}\\`)).toBe("");
  });

  test("strips response embedded between user keystrokes", () => {
    expect(stripTerminalResponses(`abc${ESC}[?1;2;4cdef`)).toBe("abcdef");
  });

  test("strips multiple sequential responses", () => {
    expect(
      stripTerminalResponses(`${ESC}[?1;2;4c${ESC}]11;rgb:1e1e/1e1e/2e2e${BEL}${ESC}[24;80R`),
    ).toBe("");
  });

  test("partial response (no terminator) is left intact", () => {
    // Defensively: don't eat half a sequence that may complete in the next chunk.
    expect(stripTerminalResponses(`${ESC}[?1;2;`)).toBe(`${ESC}[?1;2;`);
  });
});
