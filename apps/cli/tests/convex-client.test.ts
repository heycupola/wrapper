import { describe, expect, test } from "bun:test";
import { decodeJwtExpMs } from "../util/convex-client";

function makeJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${b64}.signature`;
}

describe("decodeJwtExpMs", () => {
  test("reads the exp claim and converts seconds to ms", () => {
    const jwt = makeJwt({ sub: "user_1", exp: 1_700_000_000 });
    expect(decodeJwtExpMs(jwt)).toBe(1_700_000_000_000);
  });

  test("returns null when exp is missing", () => {
    const jwt = makeJwt({ sub: "user_1" });
    expect(decodeJwtExpMs(jwt)).toBeNull();
  });

  test("returns null for a malformed token", () => {
    expect(decodeJwtExpMs("not-a-jwt")).toBeNull();
    expect(decodeJwtExpMs("")).toBeNull();
  });
});
