import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getIosAppTarget, IOS_VIEWER_DOCS_URL } from "../lib/ios-app";

describe("iOS app target", () => {
  test("falls back to the mobile viewer guide as a beta join when no URL is set", () => {
    assert.deepEqual(getIosAppTarget({}), {
      href: IOS_VIEWER_DOCS_URL,
      label: "Join the iOS beta",
      navLabel: "iOS beta",
      kind: "docs",
      external: true,
      beta: true,
      note: "Beta · TestFlight · iOS 18+ · needs a shared host session. The shell stays on the host.",
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
        navLabel: "iOS viewer",
        kind: "store",
        external: true,
        beta: false,
        note: "iOS 18+ · needs a shared host session. The shell stays on the host.",
      },
    );
  });

  test("labels TestFlight URLs as a beta join", () => {
    const target = getIosAppTarget({
      NEXT_PUBLIC_IOS_APP_URL: "https://testflight.apple.com/join/abcd",
    });
    assert.equal(target.kind, "testflight");
    assert.equal(target.label, "Join the iOS beta");
    assert.equal(target.navLabel, "iOS beta");
    assert.equal(target.beta, true);
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
