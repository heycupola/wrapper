import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clampHorizontalOffset,
  horizontalStoryHeight,
  nearestSectionIndex,
  sectionScrollTarget,
} from "../components/horizontal-scroll-math";

describe("horizontal story geometry", () => {
  test("clamps document scroll to the horizontal track range", () => {
    assert.equal(clampHorizontalOffset(80, 100, 900), 0);
    assert.equal(clampHorizontalOffset(460, 100, 900), 360);
    assert.equal(clampHorizontalOffset(1200, 100, 900), 900);
    assert.equal(clampHorizontalOffset(400, 100, 0), 0);
  });

  test("sizes the story to one viewport plus its horizontal overflow", () => {
    assert.equal(horizontalStoryHeight(900, 3600), 4500);
    assert.equal(horizontalStoryHeight(900, -20), 900);
    assert.equal(horizontalStoryHeight(-1, 200), 200);
  });

  test("caps section targets at the reachable end of the document", () => {
    assert.equal(sectionScrollTarget(40, 0, 900), 40);
    assert.equal(sectionScrollTarget(40, 420, 900), 460);
    assert.equal(sectionScrollTarget(40, 1200, 900), 940);
  });

  test("selects the section nearest the viewport center", () => {
    const sections = [
      { left: 0, center: 500 },
      { left: 1000, center: 1500 },
      { left: 2000, center: 2500 },
    ];

    assert.equal(nearestSectionIndex(0, 1000, sections), 0);
    assert.equal(nearestSectionIndex(700, 1000, sections), 1);
    assert.equal(nearestSectionIndex(1900, 1000, sections), 2);
    assert.equal(nearestSectionIndex(0, 1000, []), 0);
  });
});
