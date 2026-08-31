import { describe, expect, test } from "bun:test";
import { computeOnboardingStatus } from "../convex/lib/onboarding";

describe("computeOnboardingStatus", () => {
  test("returns completed when profile and CLI steps are done", () => {
    expect(
      computeOnboardingStatus({
        completedProfile: true,
        connectedCli: true,
      }),
    ).toBe("completed");
  });

  test("returns in_progress when any onboarding step is missing", () => {
    expect(
      computeOnboardingStatus({
        completedProfile: true,
        connectedCli: false,
      }),
    ).toBe("in_progress");
  });
});
