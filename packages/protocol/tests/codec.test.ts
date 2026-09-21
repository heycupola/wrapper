import { describe, expect, test } from "bun:test";
import {
  MAX_TERMINAL_DATA_LENGTH,
  MAX_WIRE_FRAME_BYTES,
  TERMINAL_REPLAY_CHUNK_LENGTH,
  chunkTerminalData,
  parseMessage,
  replayOutputMessages,
} from "../index";

const sessionId = "ABCDEFGHJKLM";

describe("protocol payload limits", () => {
  test("accepts terminal payload at the configured limit", () => {
    const parsed = parseMessage(
      JSON.stringify({
        type: "input",
        sessionId,
        data: "x".repeat(MAX_TERMINAL_DATA_LENGTH),
      }),
    );
    expect(parsed?.type).toBe("input");
  });

  test("rejects terminal payload above the configured limit", () => {
    expect(
      parseMessage(
        JSON.stringify({
          type: "output",
          sessionId,
          data: "x".repeat(MAX_TERMINAL_DATA_LENGTH + 1),
        }),
      ),
    ).toBeNull();
  });

  test("rejects a raw frame before parsing when it exceeds the wire cap", () => {
    expect(parseMessage("x".repeat(MAX_WIRE_FRAME_BYTES + 1))).toBeNull();
  });

  test("accepts targeted output for a single viewer", () => {
    const parsed = parseMessage(
      JSON.stringify({
        type: "output",
        sessionId,
        data: "hello",
        to: "viewer-1",
      }),
    );
    expect(parsed).toEqual({
      type: "output",
      sessionId,
      data: "hello",
      to: "viewer-1",
    });
  });

  test("chunks replay below the per-frame terminal limit", () => {
    const data = "x".repeat(TERMINAL_REPLAY_CHUNK_LENGTH * 2 + 7);
    const chunks = chunkTerminalData(data);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= TERMINAL_REPLAY_CHUNK_LENGTH)).toBe(true);
    expect(chunks.join("")).toBe(data);
  });

  test("builds targeted replay frames for one viewer", () => {
    const frames = replayOutputMessages({
      sessionId,
      data: "x".repeat(TERMINAL_REPLAY_CHUNK_LENGTH + 1),
      to: "viewer-1",
    });
    expect(frames).toHaveLength(2);
    expect(frames.every((frame) => frame.type === "output" && frame.to === "viewer-1")).toBe(true);
    expect(frames.every((frame) => frame.data.length <= MAX_TERMINAL_DATA_LENGTH)).toBe(true);
  });
});
