import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getAuthProviderAvailability,
  getSignInProviders,
  isAuthProvider,
} from "../lib/auth-providers";

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

describe("sign-in provider order", () => {
  const withApple = { apple: true, github: true, google: true };
  const withoutApple = { apple: false, github: true, google: true };

  test("keeps the default GitHub-first order", () => {
    assert.deepEqual(getSignInProviders(withoutApple), ["github", "google"]);
    assert.deepEqual(getSignInProviders(withApple), ["github", "google", "apple"]);
  });

  test("moves the last used provider to the front", () => {
    assert.deepEqual(getSignInProviders(withApple, "google"), ["google", "github", "apple"]);
    assert.deepEqual(getSignInProviders(withApple, "apple"), ["apple", "github", "google"]);
  });

  test("ignores last-used values that are unavailable or unknown", () => {
    assert.deepEqual(getSignInProviders(withoutApple, "apple"), ["github", "google"]);
    assert.deepEqual(getSignInProviders(withApple, "email"), ["github", "google", "apple"]);
    assert.deepEqual(getSignInProviders(withApple, null), ["github", "google", "apple"]);
  });

  test("recognizes only the configured social providers", () => {
    assert.equal(isAuthProvider("github"), true);
    assert.equal(isAuthProvider("email"), false);
    assert.equal(isAuthProvider(null), false);
  });
});
