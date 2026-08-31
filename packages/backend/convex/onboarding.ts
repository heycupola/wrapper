import { v } from "convex/values";
import { protectedMutation, protectedQuery } from "./lib/middleware.ts";
import { applyOnboardingStep } from "./lib/onboarding.ts";

const onboardingStep = v.union(v.literal("completedProfile"), v.literal("connectedCli"));

export const getState = protectedQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();

    if (!row) {
      return {
        needsOnboarding: true,
        status: "in_progress" as const,
        completedProfile: false,
        connectedCli: false,
      };
    }

    return {
      needsOnboarding: row.status !== "completed",
      status: row.status,
      completedProfile: row.completedProfile,
      connectedCli: row.connectedCli,
      source: row.source ?? null,
      sourceOther: row.sourceOther ?? null,
      teamSize: row.teamSize ?? null,
      completedAt: row.completedAt ?? null,
    };
  },
});

export const completeStep = protectedMutation({
  args: {
    step: onboardingStep,
    value: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const status = await applyOnboardingStep(ctx, args.step, args.value ?? true);
    return { ok: true, status };
  },
});

export const complete = protectedMutation({
  args: {
    source: v.optional(v.string()),
    sourceOther: v.optional(v.string()),
    teamSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const row = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const finished = {
      completedProfile: true,
      connectedCli: true,
      status: "completed" as const,
      source: args.source,
      sourceOther: args.sourceOther,
      teamSize: args.teamSize,
      updatedAt: now,
      completedAt: now,
    };

    if (!row) {
      await ctx.db.insert("onboarding", {
        userId: ctx.userId,
        createdAt: now,
        ...finished,
      });
      return { ok: true };
    }

    await ctx.db.patch(row._id, {
      ...finished,
      completedAt: row.completedAt ?? now,
      sharedFirstSession: undefined,
    });

    return { ok: true };
  },
});
