import { v } from "convex/values";
import { protectedMutation, protectedQuery } from "./lib/middleware.ts";
import { createError, ErrorCode } from "./lib/errors.ts";
import { ErrorSeverity } from "./lib/types.ts";
import { computeOnboardingStatus } from "./lib/onboarding.ts";

const onboardingStep = v.union(
  v.literal("completedProfile"),
  v.literal("connectedCli"),
  v.literal("sharedFirstSession"),
);

type OnboardingStep = "completedProfile" | "connectedCli" | "sharedFirstSession";

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
        sharedFirstSession: false,
      };
    }

    return {
      needsOnboarding: row.status !== "completed",
      status: row.status,
      completedProfile: row.completedProfile,
      connectedCli: row.connectedCli,
      sharedFirstSession: row.sharedFirstSession,
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
    const now = Date.now();
    const nextValue = args.value ?? true;
    const row = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();

    if (!row) {
      const base = {
        completedProfile: false,
        connectedCli: false,
        sharedFirstSession: false,
      };
      base[args.step as OnboardingStep] = nextValue;
      const status = computeOnboardingStatus(base);
      await ctx.db.insert("onboarding", {
        userId: ctx.userId,
        completedProfile: base.completedProfile,
        connectedCli: base.connectedCli,
        sharedFirstSession: base.sharedFirstSession,
        status,
        createdAt: now,
        updatedAt: now,
        completedAt: status === "completed" ? now : undefined,
      });
      return { ok: true, status };
    }

    const patch: {
      completedProfile?: boolean;
      connectedCli?: boolean;
      sharedFirstSession?: boolean;
      status?: "in_progress" | "completed";
      updatedAt: number;
      completedAt?: number;
    } = { updatedAt: now };
    patch[args.step] = nextValue;

    const status = computeOnboardingStatus({
      completedProfile: patch.completedProfile ?? row.completedProfile,
      connectedCli: patch.connectedCli ?? row.connectedCli,
      sharedFirstSession: patch.sharedFirstSession ?? row.sharedFirstSession,
    });
    patch.status = status;
    if (status === "completed") patch.completedAt = now;
    await ctx.db.patch(row._id, patch);

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
    if (!row) {
      throw createError({
        code: ErrorCode.INVALID_OPERATION,
        message: "Cannot complete onboarding before finishing required steps",
        severity: ErrorSeverity.Medium,
      });
    }

    const nextStatus = computeOnboardingStatus(row);
    if (nextStatus !== "completed") {
      throw createError({
        code: ErrorCode.INVALID_OPERATION,
        message: "Complete all onboarding steps first",
        severity: ErrorSeverity.Medium,
      });
    }

    await ctx.db.patch(row._id, {
      status: "completed",
      source: args.source,
      sourceOther: args.sourceOther,
      teamSize: args.teamSize,
      updatedAt: now,
      completedAt: row.completedAt ?? now,
    });

    return { ok: true };
  },
});
