import { describe, expect, test } from "bun:test";
import { computeOnboardingStatus } from "../convex/lib/onboarding";

describe("computeOnboardingStatus", () => {
  test("returns completed when all onboarding steps are done", () => {
    expect(
      computeOnboardingStatus({
        completedProfile: true,
        connectedCli: true,
        sharedFirstSession: true,
      }),
    ).toBe("completed");
  });

  test("returns in_progress when any onboarding step is missing", () => {
    expect(
      computeOnboardingStatus({
        completedProfile: true,
        connectedCli: false,
        sharedFirstSession: true,
      }),
    ).toBe("in_progress");
  });
});
