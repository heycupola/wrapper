import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { encodeMessage, parseMessage, PROTOCOL_VERSION } from "../index";

type ValidFixture = {
  direction: "bidirectional" | "client-to-host" | "host-to-client";
  expectedType: string;
  name: string;
  wire: string;
};

type InvalidFixture = {
  name: string;
  wire: string;
};

type FixtureManifest = {
  fixtureFormatVersion: number;
  invalid: InvalidFixture[];
  protocolVersion: number;
  valid: ValidFixture[];
};

const fixtures = JSON.parse(
  readFileSync(new URL("../fixtures/wire-v1.json", import.meta.url), "utf8"),
) as FixtureManifest;

describe("shared wire protocol fixtures", () => {
  test("tracks the current protocol and has unique case names", () => {
    expect(fixtures.fixtureFormatVersion).toBe(1);
    expect(fixtures.protocolVersion).toBe(PROTOCOL_VERSION);

    const names = [...fixtures.valid, ...fixtures.invalid].map((fixture) => fixture.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const fixture of fixtures.valid) {
    test(`accepts ${fixture.name}`, () => {
      const parsed = parseMessage(fixture.wire);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe(fixture.expectedType);

      const encoded = encodeMessage(parsed!);
      const roundTripped = parseMessage(encoded);
      expect(roundTripped?.type).toBe(fixture.expectedType);
      expect(roundTripped?.protocolVersion).toBe(PROTOCOL_VERSION);
    });
  }

  for (const fixture of fixtures.invalid) {
    test(`rejects ${fixture.name}`, () => {
      expect(parseMessage(fixture.wire)).toBeNull();
    });
  }
});
