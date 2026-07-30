import { describe, expect, test } from "bun:test";
import {
  MAX_TERMINAL_DATA_LENGTH,
  MAX_WIRE_FRAME_BYTES,
  WrapperMessageSchema,
  encodeMessage as repoEncode,
  parseMessage as repoParse,
  type WrapperMessage as RepoMessage,
} from "@repo/protocol";
import { encodeMessage as relayEncode, parseMessage as relayParse } from "../src/protocol";

/**
 * The relay ships a deploy-time copy of the wire protocol (see
 * `src/protocol.ts`). This test fails if that copy drifts from
 * `@repo/protocol` — either a new message type is added upstream, or the
 * encode/parse behaviour diverges for an existing one.
 */

const samples: RepoMessage[] = [
  { type: "attach", sessionId: "s1" },
  { type: "detach", sessionId: "s1" },
  { type: "input", sessionId: "s1", data: "ls\n" },
  { type: "resize", sessionId: "s1", size: { cols: 80, rows: 24 } },
  { type: "session.opened", sessionId: "s1", size: { cols: 80, rows: 24 } },
  { type: "session.closed", sessionId: "s1", exitCode: 0 },
  { type: "output", sessionId: "s1", data: "hi" },
  { type: "error", sessionId: "s1", code: "internal", message: "boom" },
  { type: "signal", sessionId: "s1", to: "host", from: "p1", kind: "offer", data: "{}" },
];

describe("relay protocol parity with @repo/protocol", () => {
  test("relay handles every message type @repo/protocol defines", () => {
    const repoTypes = new Set(
      WrapperMessageSchema.options.map((option) => option.shape.type.value as string),
    );
    const sampleTypes = new Set<string>(samples.map((message) => message.type));
    expect(sampleTypes).toEqual(repoTypes);
  });

  test("messages round-trip identically across both implementations", () => {
    for (const message of samples) {
      const repoWire = repoEncode(message);
      const relayWire = relayEncode(message);
      expect(relayWire).toBe(repoWire);
      expect(relayParse(repoWire)).toEqual({ ...message, protocolVersion: 1 });
      expect(repoParse(relayWire)).toEqual({ ...message, protocolVersion: 1 });
    }
  });

  test("version 1 is emitted while unversioned v0 frames remain readable", () => {
    const message: RepoMessage = { type: "detach", sessionId: "s1" };
    expect(JSON.parse(repoEncode(message))).toMatchObject({ protocolVersion: 1 });
    expect(repoParse(JSON.stringify(message))).toEqual(message);
    expect(relayParse(JSON.stringify(message))).toEqual(message);
  });

  test("both implementations reject oversized terminal and raw frames", () => {
    const oversizedTerminal = JSON.stringify({
      type: "input",
      sessionId: "s1",
      data: "x".repeat(MAX_TERMINAL_DATA_LENGTH + 1),
    });
    const oversizedWire = "x".repeat(MAX_WIRE_FRAME_BYTES + 1);

    expect(repoParse(oversizedTerminal)).toBeNull();
    expect(relayParse(oversizedTerminal)).toBeNull();
    expect(repoParse(oversizedWire)).toBeNull();
    expect(relayParse(oversizedWire)).toBeNull();
  });
});
