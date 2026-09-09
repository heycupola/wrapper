import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseConsent } from "../lib/analytics-consent";
import { readCookie } from "../lib/cookies";
import { EU_EEA_COUNTRIES, isEuGeo, regionFromCountry } from "../lib/geo";

describe("geo region", () => {
  test("treats missing country as EU so local traffic requires consent", () => {
    assert.equal(regionFromCountry(undefined), "eu");
    assert.equal(regionFromCountry(""), "eu");
    assert.equal(regionFromCountry("  "), "eu");
  });

  test("maps EU, EEA, UK, and Switzerland to eu", () => {
    for (const country of ["DE", "fr", "GB", "CH", "NO", "IS"]) {
      assert.equal(regionFromCountry(country), "eu", country);
    }
  });

  test("maps other countries to other", () => {
    assert.equal(regionFromCountry("US"), "other");
    assert.equal(regionFromCountry("TR"), "other");
    assert.equal(regionFromCountry("JP"), "other");
  });

  test("treats missing or eu cookies as the EU consent region", () => {
    assert.equal(isEuGeo(null), true);
    assert.equal(isEuGeo("eu"), true);
    assert.equal(isEuGeo("other"), false);
  });

  test("includes the UK and Switzerland in the consent set", () => {
    assert.equal(EU_EEA_COUNTRIES.has("GB"), true);
    assert.equal(EU_EEA_COUNTRIES.has("CH"), true);
    assert.equal(EU_EEA_COUNTRIES.has("US"), false);
  });
});

describe("cookie parsing", () => {
  test("reads a named cookie from a header", () => {
    assert.equal(readCookie("wrapper-geo=eu; other=1", "wrapper-geo"), "eu");
    assert.equal(readCookie("a=1; wrapper-geo=other", "wrapper-geo"), "other");
    assert.equal(readCookie("wrapper-geo=eu", "missing"), null);
  });
});

describe("consent storage values", () => {
  test("accepts only accepted or rejected", () => {
    assert.equal(parseConsent("accepted"), "accepted");
    assert.equal(parseConsent("rejected"), "rejected");
    assert.equal(parseConsent("yes"), null);
    assert.equal(parseConsent(null), null);
  });
});
