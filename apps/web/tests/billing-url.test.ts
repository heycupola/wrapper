import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getSafeBillingPortalUrl, getSafeCheckoutUrl } from "../lib/billing-url";

describe("billing URL safety", () => {
  test("accepts only the expected Stripe destination for each flow", () => {
    assert.equal(
      getSafeBillingPortalUrl("https://billing.stripe.com/p/session_123?prefilled_email=a%40b.com"),
      "https://billing.stripe.com/p/session_123?prefilled_email=a%40b.com",
    );
    assert.equal(
      getSafeCheckoutUrl(
        "https://checkout.stripe.com/c/pay/cs_test_123#fidkdWxOYHwnPyd1blpxYHZxWjA0",
      ),
      "https://checkout.stripe.com/c/pay/cs_test_123#fidkdWxOYHwnPyd1blpxYHZxWjA0",
    );

    assert.equal(getSafeBillingPortalUrl("https://checkout.stripe.com/c/pay/cs_test_123"), null);
    assert.equal(getSafeCheckoutUrl("https://billing.stripe.com/p/session_123"), null);
  });

  test("rejects insecure, credentialed, non-default-port, and lookalike URLs", () => {
    const unsafePortalUrls = [
      "http://billing.stripe.com/p/session_123",
      "https://user:secret@billing.stripe.com/p/session_123",
      "https://billing.stripe.com:8443/p/session_123",
      "https://billing.stripe.com.evil.example/p/session_123",
      "https://billing.stripe.com@evil.example/p/session_123",
      "//billing.stripe.com/p/session_123",
      "not a url",
    ];

    for (const value of unsafePortalUrls) {
      assert.equal(getSafeBillingPortalUrl(value), null, value);
    }
  });
});
