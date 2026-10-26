import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const docsJsonPath = join(import.meta.dir, "..", "docs.json");
const docsJson = readFileSync(docsJsonPath, "utf8");

describe("docs Discord invite", () => {
  test("navbar uses the canonical Cupola Discord invite", () => {
    expect(docsJson).toContain("https://discord.gg/2vNRzRMY6K");
  });

  test("does not keep expired heycupola or relic Discord invites", () => {
    expect(docsJson).not.toContain("discord.gg/heycupola");
    expect(docsJson).not.toContain("discord.gg/relic");
  });
});
