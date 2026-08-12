import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAuthProviderAvailability } from "../lib/auth-providers";

describe("auth provider availability", () => {
  test("keeps the baseline providers available", () => {
    assert.deepEqual(getAuthProviderAvailability({}), {
      apple: false,
      github: true,
      google: true,
    });
  });

  test("enables Apple only for the exact public flag value", () => {
    assert.equal(
      getAuthProviderAvailability({ NEXT_PUBLIC_APPLE_AUTH_ENABLED: "true" }).apple,
      true,
    );

    for (const value of ["TRUE", "1", "yes", " true ", "false", ""]) {
      assert.equal(
        getAuthProviderAvailability({ NEXT_PUBLIC_APPLE_AUTH_ENABLED: value }).apple,
        false,
        value,
      );
    }
  });
});
