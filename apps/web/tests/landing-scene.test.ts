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
    assert.equal(peekLandingScene(["start"]), "start");
  });

  test("ignores hashes that are not landing scenes", () => {
    resetLandingSceneMemory();
    rememberLandingScene("start");
    const previous = (globalThis as { window?: Window }).window;
    (globalThis as { window?: Window }).window = {
      location: { hash: "#main-content" },
    } as Window;
    try {
      assert.equal(peekLandingScene(["intro", "start"]), "start");
    } finally {
      if (previous === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        (globalThis as { window?: Window }).window = previous;
      }
    }
  });
});
