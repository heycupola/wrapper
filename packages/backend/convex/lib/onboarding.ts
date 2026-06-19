export type OnboardingSteps = {
  completedProfile: boolean;
  connectedCli: boolean;
  sharedFirstSession: boolean;
};

export function computeOnboardingStatus(steps: OnboardingSteps): "in_progress" | "completed" {
  return steps.completedProfile && steps.connectedCli && steps.sharedFirstSession
    ? "completed"
    : "in_progress";
}
