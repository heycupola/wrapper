import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  WRAPPER_CLI_CLIENT_ID,
  WRAPPER_MOBILE_IOS_CLIENT_ID,
  deviceClientLabel,
  normalizeUserCode,
} from "../lib/device-auth";

describe("device client labels", () => {
  test("names the CLI and iOS viewer instead of raw client ids", () => {
    assert.equal(deviceClientLabel(undefined), "Wrapper CLI");
    assert.equal(deviceClientLabel(WRAPPER_CLI_CLIENT_ID), "Wrapper CLI");
    assert.equal(deviceClientLabel(WRAPPER_MOBILE_IOS_CLIENT_ID), "iPhone and iPad viewer");
    assert.equal(deviceClientLabel("wrapper-unknown"), "wrapper-unknown");
  });
});

describe("user codes", () => {
  test("accepts spaced or lowercase codes from the URL or the form", () => {
    assert.equal(normalizeUserCode("abcd-1234"), "ABCD-1234");
    assert.equal(normalizeUserCode("  abcd 1234  "), "ABCD-1234");
  });

  test("rejects codes that are too short, too long, or not alphanumeric", () => {
    assert.equal(normalizeUserCode("AB"), "");
    assert.equal(normalizeUserCode("A".repeat(33)), "");
    assert.equal(normalizeUserCode("ABCD_1234"), "");
  });
});
