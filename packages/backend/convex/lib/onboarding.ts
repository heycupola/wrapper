import type { MutationCtx } from "../_generated/server.js";

export type OnboardingStep = "completedProfile" | "connectedCli";

export type OnboardingSteps = {
  completedProfile: boolean;
  connectedCli: boolean;
};

export function computeOnboardingStatus(steps: OnboardingSteps): "in_progress" | "completed" {
  return steps.completedProfile && steps.connectedCli ? "completed" : "in_progress";
}

export async function applyOnboardingStep(
  ctx: Pick<MutationCtx, "db"> & { userId: string },
  step: OnboardingStep,
  value = true,
): Promise<"in_progress" | "completed"> {
  const now = Date.now();
  const row = await ctx.db
    .query("onboarding")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .first();

  if (!row) {
    const base: OnboardingSteps = {
      completedProfile: false,
      connectedCli: false,
    };
    base[step] = value;
    const status = computeOnboardingStatus(base);
    await ctx.db.insert("onboarding", {
      userId: ctx.userId,
      completedProfile: base.completedProfile,
      connectedCli: base.connectedCli,
      status,
      createdAt: now,
      updatedAt: now,
      completedAt: status === "completed" ? now : undefined,
    });
    return status;
  }

  const next: OnboardingSteps = {
    completedProfile: row.completedProfile,
    connectedCli: row.connectedCli,
  };
  next[step] = value;
  const status = computeOnboardingStatus(next);
  await ctx.db.patch(row._id, {
    [step]: value,
    status,
    updatedAt: now,
    completedAt: status === "completed" ? (row.completedAt ?? now) : undefined,
    sharedFirstSession: undefined,
  });
  return status;
}
