import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BILLING_INTERVAL_OPTIONS, PRO_PRICE } from "../lib/pro-pricing";

describe("pro pricing", () => {
  test("features yearly first and shows the monthly rate of that price", () => {
    assert.equal(BILLING_INTERVAL_OPTIONS[0]?.value, "year");
    assert.equal(PRO_PRICE.year.amount, "$99");
    assert.equal(PRO_PRICE.year.rate?.amount, "$8.25");
    assert.equal(PRO_PRICE.month.rate, null);
  });
});
