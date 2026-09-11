import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "../lib/plan-features";
import { BILLING_INTERVAL_OPTIONS, PRO_PRICE } from "../lib/pro-pricing";

describe("pro pricing", () => {
  test("features yearly first and shows the monthly rate of that price", () => {
    assert.equal(BILLING_INTERVAL_OPTIONS[0]?.value, "year");
    assert.equal(PRO_PRICE.year.amount, "$99");
    assert.equal(PRO_PRICE.year.rate?.amount, "$8.25");
    assert.equal(PRO_PRICE.month.rate, null);
  });
});

describe("plan features", () => {
  test("every term appears in its label so the hover target can render", () => {
    for (const feature of [...FREE_PLAN_FEATURES, ...PRO_PLAN_FEATURES]) {
      if (!feature.term) continue;
      assert.ok(
        feature.label.includes(feature.term),
        `${feature.label} should include ${feature.term}`,
      );
      assert.ok(feature.definition && feature.definition.length > 0);
    }
  });

  test("pro includes a remote linux host and stays short", () => {
    assert.ok(PRO_PLAN_FEATURES.some((feature) => /linux box/i.test(feature.label)));
    assert.ok(FREE_PLAN_FEATURES.length <= 4);
    assert.ok(PRO_PLAN_FEATURES.length <= 5);
  });
});
