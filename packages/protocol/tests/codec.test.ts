import { describe, expect, test } from "bun:test";
import { MAX_TERMINAL_DATA_LENGTH, MAX_WIRE_FRAME_BYTES, parseMessage } from "../index";

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
});
