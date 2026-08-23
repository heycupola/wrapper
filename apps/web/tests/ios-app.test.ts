import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getIosAppTarget, IOS_VIEWER_DOCS_URL } from "../lib/ios-app";

describe("iOS app target", () => {
  test("falls back to the mobile viewer guide when no URL is set", () => {
    assert.deepEqual(getIosAppTarget({}), {
      href: IOS_VIEWER_DOCS_URL,
      label: "Get the iOS viewer",
      kind: "docs",
      external: true,
    });
  });

  test("uses the App Store listing when a store URL is provided", () => {
    assert.deepEqual(
      getIosAppTarget({
        NEXT_PUBLIC_IOS_APP_URL: "https://apps.apple.com/app/wrapper/id000",
      }),
      {
        href: "https://apps.apple.com/app/wrapper/id000",
        label: "Get the iOS viewer",
        kind: "store",
        external: true,
      },
    );
  });

  test("labels TestFlight URLs as a beta join", () => {
    assert.equal(
      getIosAppTarget({
        NEXT_PUBLIC_IOS_APP_URL: "https://testflight.apple.com/join/abcd",
      }).kind,
      "testflight",
    );
    assert.equal(
      getIosAppTarget({
        NEXT_PUBLIC_IOS_APP_URL: "https://testflight.apple.com/join/abcd",
      }).label,
      "Join the iOS beta",
    );
  });

  test("lets an explicit label override the default copy", () => {
    assert.equal(
      getIosAppTarget({
        NEXT_PUBLIC_IOS_APP_URL: "https://apps.apple.com/app/wrapper/id000",
        NEXT_PUBLIC_IOS_APP_LABEL: "Open Wrapper on iPhone",
      }).label,
      "Open Wrapper on iPhone",
    );
  });

  test("rejects non-http URLs", () => {
    assert.equal(getIosAppTarget({ NEXT_PUBLIC_IOS_APP_URL: "javascript:alert(1)" }).kind, "docs");
  });
});
