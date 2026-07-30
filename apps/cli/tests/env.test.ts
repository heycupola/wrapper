import { describe, expect, test } from "bun:test";
import { PRODUCTION_CONVEX_URL, resolveConvexUrl } from "../util/auth-session";
import { isDevelopmentNodeEnv } from "../util/env";

describe("runtime environment defaults", () => {
  test("only explicit development and test modes use local defaults", () => {
    expect(isDevelopmentNodeEnv("development")).toBe(true);
    expect(isDevelopmentNodeEnv("TEST")).toBe(true);
    expect(isDevelopmentNodeEnv("production")).toBe(false);
    expect(isDevelopmentNodeEnv(undefined)).toBe(false);
  });

  test("production has a working Convex default", () => {
    expect(resolveConvexUrl({}, true)).toBe(PRODUCTION_CONVEX_URL);
  });

  test("explicit Convex URL overrides the production default", () => {
    expect(
      resolveConvexUrl(
        {
          WRAPPER_CONVEX_URL: "https://custom.convex.cloud/",
        },
        true,
      ),
    ).toBe("https://custom.convex.cloud");
  });

  test("development remains unconfigured without an explicit Convex URL", () => {
    expect(resolveConvexUrl({}, false)).toBeNull();
  });
});
