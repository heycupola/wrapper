import { expect, test } from "bun:test";
import parseFrontMatter from "front-matter";

test("patched front-matter parses YAML with js-yaml v4 load()", () => {
  const parsed = parseFrontMatter<Record<string, unknown>>(
    "---\ntitle: Wrapper\ncount: 2\n---\nbody",
  );

  expect(parsed.attributes).toEqual({ title: "Wrapper", count: 2 });
  expect(parsed.body.trim()).toBe("body");
});
