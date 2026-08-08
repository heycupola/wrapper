import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { protectedAction } from "./lib/middleware";

export const prepareDeletion = protectedAction({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.autumn.customers.delete(ctx);
    return {
      billingCleanupSucceeded: result.error === null,
    };
  },
});

export const deleteOwnedData = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const deletedTicketIds = new Set<string>();
    const sessions = await ctx.db
      .query("hostSession")
      .withIndex("by_owner", (query) => query.eq("ownerUserId", args.userId))
      .collect();

    for (const session of sessions) {
      for (const role of ["host", "viewer"] as const) {
        const tickets = await ctx.db
          .query("relayTicket")
          .withIndex("by_session_role", (query) =>
            query.eq("sessionId", session.sessionId).eq("role", role),
          )
          .collect();
        for (const ticket of tickets) {
          deletedTicketIds.add(String(ticket._id));
          await ctx.db.delete(ticket._id);
        }
      }
    }

    const viewerTickets = await ctx.db
      .query("relayTicket")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect();
    for (const ticket of viewerTickets) {
      if (deletedTicketIds.has(String(ticket._id))) continue;
      deletedTicketIds.add(String(ticket._id));
      await ctx.db.delete(ticket._id);
    }

    const onboardingRows = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect();
    for (const row of onboardingRows) {
      await ctx.db.delete(row._id);
    }

    const rateLimits = await ctx.db.query("rateLimit").collect();
    for (const row of rateLimits) {
      if (row.key.includes(`user:${args.userId}`)) {
        await ctx.db.delete(row._id);
      }
    }

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return {
      sessions: sessions.length,
      onboardingRows: onboardingRows.length,
      relayTickets: deletedTicketIds.size,
    };
  },
});
