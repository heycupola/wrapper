import { describe, expect, test } from "bun:test";
import { looksAutomated, normalizeEmail, sha256Hex } from "../convex/lib/releaseNotes";

describe("release-notes helpers", () => {
  test("normalizes and rejects email addresses", () => {
    expect(normalizeEmail("  Dev@Example.COM ")).toBe("dev@example.com");
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("dots..twice@example.com")).toBeNull();
    expect(normalizeEmail(`${"x".repeat(250)}@example.com`)).toBeNull();
  });

  test("flags honeypot and instant submissions as automated", () => {
    expect(looksAutomated({ honeypot: "http://spam" })).toBe(true);
    expect(looksAutomated({ elapsedMs: 300 })).toBe(true);
    expect(looksAutomated({ elapsedMs: 4000 })).toBe(false);
    expect(looksAutomated({})).toBe(false);
  });

  test("hashes deterministically", async () => {
    expect(await sha256Hex("wrapper")).toBe(await sha256Hex("wrapper"));
    expect(await sha256Hex("wrapper")).toMatch(/^[0-9a-f]{64}$/);
  });
});
