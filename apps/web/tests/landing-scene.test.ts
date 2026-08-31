import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clearLandingScene,
  peekLandingScene,
  rememberLandingScene,
  resetLandingSceneMemory,
} from "../lib/landing-scene";

describe("landing scene memory", () => {
  test("survives a storage clear so a Strict Mode remount can still peek", () => {
    resetLandingSceneMemory();
    rememberLandingScene("start");
    clearLandingScene("start");
    assert.equal(peekLandingScene(), "start");
  });
});
