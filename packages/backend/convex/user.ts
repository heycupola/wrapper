import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { createError, ErrorCode } from "./lib/errors.ts";
import { createLogger } from "./lib/logger.ts";
import { EmailKind, ErrorSeverity } from "./lib/types.ts";
import { sendEmail, sendEmailDirect } from "./resend.ts";

const log = createLogger("user");
const ACCESS_RESTRICTED_AFTER_MS = 86_400_000 * 7;

type AuthUser = {
  _id: string;
  email: string;
  name?: string | null;
};

async function loadAuthUser(ctx: ActionCtx, userId: string): Promise<AuthUser> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", operator: "eq", value: userId }],
  })) as AuthUser | null;

  if (!user) {
    throw createError({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: "User not found",
      severity: ErrorSeverity.Medium,
    });
  }

  return user;
}

export const _upgradeToPro = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const patch = {
      hasPro: true,
      planDowngradedAt: undefined,
      gracePeriodEmailSent: undefined,
      accessRestrictedEmailSent: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { success: true };
    }
    await ctx.db.insert("emailState", { userId: args.userId, hasPro: true });
    return { success: true };
  },
});

export const _downgradeToFree = internalMutation({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newlyDowngraded: v.boolean(),
    gracePeriodEmailSent: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("emailState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing && existing.hasPro !== true && existing.planDowngradedAt !== undefined) {
      if (existing.hasPro !== false) {
        await ctx.db.patch(existing._id, { hasPro: false });
      }
      return {
        success: true,
        newlyDowngraded: false,
        gracePeriodEmailSent: existing.gracePeriodEmailSent === true,
      };
    }

    const patch = {
      hasPro: false,
      planDowngradedAt: now,
      gracePeriodEmailSent: undefined,
      accessRestrictedEmailSent: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { success: true, newlyDowngraded: true, gracePeriodEmailSent: false };
    }
    await ctx.db.insert("emailState", {
      userId: args.userId,
      hasPro: false,
      planDowngradedAt: now,
    });
    return { success: true, newlyDowngraded: true, gracePeriodEmailSent: false };
  },
});

export const _updateEmailStateAfterEmailSent = internalMutation({
  args: {
    userId: v.string(),
    emailKind: v.union(
      v.literal(EmailKind.AccessRestricted),
      v.literal(EmailKind.CollaboratorAdded),
      v.literal(EmailKind.GracePeriodStarted),
      v.literal(EmailKind.PlanUpgraded),
      v.literal(EmailKind.Welcome),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (args.emailKind === EmailKind.AccessRestricted) {
      if (existing) {
        await ctx.db.patch(existing._id, { accessRestrictedEmailSent: true });
      } else {
        await ctx.db.insert("emailState", {
          userId: args.userId,
          accessRestrictedEmailSent: true,
        });
      }
    } else if (args.emailKind === EmailKind.GracePeriodStarted) {
      if (existing) {
        await ctx.db.patch(existing._id, { gracePeriodEmailSent: true });
      } else {
        await ctx.db.insert("emailState", {
          userId: args.userId,
          gracePeriodEmailSent: true,
        });
      }
    }

    return { success: true };
  },
});

export const _loadUsersToRestrict = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ACCESS_RESTRICTED_AFTER_MS;
    const downgraded = await ctx.db
      .query("emailState")
      .withIndex("by_plan_downgraded", (q) => q.lt("planDowngradedAt", cutoff))
      .collect();

    const usersToRestrict = downgraded.filter(
      (row) => row.hasPro !== true && row.accessRestrictedEmailSent !== true,
    );

    return { success: true, usersToRestrict };
  },
});

export const _countUserSessions = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("hostSession")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", args.userId))
      .collect();
    const tickets = await ctx.db
      .query("relayTicket")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      ownedSessionCount: sessions.length,
      sharedSessionCount: tickets.filter((ticket) => ticket.role === "viewer").length,
    };
  },
});

export const _handlePlanUpgrade = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadAuthUser(ctx, args.userId);

    await ctx.runMutation(internal.user._upgradeToPro, {
      userId: user._id,
    });

    log.info("User upgraded to Pro", { userId: user._id });

    await sendEmail(ctx, user._id, user.email, {
      kind: EmailKind.PlanUpgraded,
      userName: user.name || "there",
    });
  },
});

export const _handlePlanDowngrade = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadAuthUser(ctx, args.userId);

    const downgrade = await ctx.runMutation(internal.user._downgradeToFree, {
      userId: user._id,
    });

    log.info("User downgraded to Free", {
      userId: user._id,
      newlyDowngraded: downgrade.newlyDowngraded,
    });

    if (downgrade.gracePeriodEmailSent) {
      return;
    }

    const sent = await sendEmail(ctx, user._id, user.email, {
      kind: EmailKind.GracePeriodStarted,
      daysRemaining: 7,
      userName: user.name || "there",
    });
    if (sent.emailId === "skipped") {
      return;
    }

    await ctx.runMutation(internal.user._updateEmailStateAfterEmailSent, {
      userId: user._id,
      emailKind: EmailKind.GracePeriodStarted,
    });
  },
});

export const _handleEmailDelivered = internalMutation({
  args: {
    userId: v.string(),
    emailKind: v.union(
      v.literal(EmailKind.AccessRestricted),
      v.literal(EmailKind.CollaboratorAdded),
      v.literal(EmailKind.GracePeriodStarted),
      v.literal(EmailKind.PlanUpgraded),
      v.literal(EmailKind.Welcome),
    ),
    emailId: v.string(),
    deliveredAt: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.user._updateEmailStateAfterEmailSent, {
      emailKind: args.emailKind,
      userId: args.userId,
    });

    return { success: true };
  },
});

export const _handleEmailFailed = internalMutation({
  args: {
    userId: v.string(),
    emailKind: v.string(),
    reason: v.string(),
    failedAt: v.number(),
  },
  handler: async (_ctx, args) => {
    log.error("Failed to deliver email", {
      emailKind: args.emailKind,
      userId: args.userId,
      reason: args.reason,
    });
  },
});

export const _batchSendAccessRestrictedEmails = internalAction({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const { usersToRestrict } = await ctx.runQuery(internal.user._loadUsersToRestrict, {});

    log.info("Access restriction cron started", { usersToRestrict: usersToRestrict.length });

    for (const state of usersToRestrict) {
      const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", operator: "eq", value: state.userId }],
      })) as AuthUser | null;
      if (!user?.email) continue;

      const counts = await ctx.runQuery(internal.user._countUserSessions, {
        userId: state.userId,
      });

      const sent = await sendEmail(ctx, user._id, user.email, {
        kind: EmailKind.AccessRestricted,
        ownedSessionCount: counts.ownedSessionCount,
        sharedSessionCount: counts.sharedSessionCount,
        userName: user.name || "there",
      });
      if (sent.emailId === "skipped") {
        continue;
      }

      await ctx.runMutation(internal.user._updateEmailStateAfterEmailSent, {
        userId: user._id,
        emailKind: EmailKind.AccessRestricted,
      });
    }

    log.info("Access restriction cron completed", { processed: usersToRestrict.length });

    return { success: true };
  },
});

export const _sendWelcomeEmail = internalAction({
  args: {
    userId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await loadAuthUser(ctx, args.userId);

    await sendEmail(ctx, user._id, user.email, {
      kind: EmailKind.Welcome,
      userName: user.name || "there",
    });

    return { success: true };
  },
});

export const _sendAccountDeletedEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    sessionsDeleted: v.number(),
    ticketsRevoked: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (_ctx, args) => {
    try {
      await sendEmailDirect(args.to, {
        kind: EmailKind.AccountDeleted,
        userName: args.userName,
        sessionsDeleted: args.sessionsDeleted,
        ticketsRevoked: args.ticketsRevoked,
      });
    } catch (error) {
      log.error("Failed to send account deletion email", { error: String(error) });
    }

    return { success: true };
  },
});
