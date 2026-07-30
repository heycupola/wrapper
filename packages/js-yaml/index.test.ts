import { describe, expect, test } from "bun:test";
import yaml from "./index.cjs";

describe("safe js-yaml compatibility shim", () => {
  test("supports current load and legacy safeLoad with identical results", () => {
    const source = 'title: "Wrapper"\ncount: 2';
    expect(yaml.load(source)).toEqual({ title: "Wrapper", count: 2 });
    expect(yaml.safeLoad(source)).toEqual({ title: "Wrapper", count: 2 });
  });

  test("supports current dump and legacy safeDump", () => {
    const value = { title: "Wrapper", enabled: true };
    expect(yaml.safeLoad(yaml.dump(value))).toEqual(value);
    expect(yaml.safeLoad(yaml.safeDump(value))).toEqual(value);
  });
});
