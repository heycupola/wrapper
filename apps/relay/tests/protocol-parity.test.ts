import { describe, expect, test } from "bun:test";
import {
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
      expect(relayParse(repoWire)).toEqual(message);
      expect(repoParse(relayWire)).toEqual(message);
    }
  });
});
