import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { initAutumn } from "./autumn.ts";
import { authComponent } from "./auth";
import { protectedAction } from "./lib/middleware";

export const prepareDeletion = protectedAction({
  args: {},
  handler: async () => {
    return {
      billingCleanupSucceeded: true,
    };
  },
});

export const deleteBillingCustomer = internalAction({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const autumn = initAutumn({
      customerId: args.userId,
      customerData: {
        email: args.email,
        name: args.name,
      },
    });
    const result = await autumn.customers.delete(ctx);
    if (result.error !== null) {
      throw new Error("Unable to remove the billing customer");
    }
    return { succeeded: true };
  },
});

export const deleteOwnedData = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("hostSession")
      .withIndex("by_owner", (query) => query.eq("ownerUserId", args.userId))
      .collect();
    const sessionTicketGroups = await Promise.all(
      sessions.flatMap((session) =>
        (["host", "viewer"] as const).map((role) =>
          ctx.db
            .query("relayTicket")
            .withIndex("by_session_role", (query) =>
              query.eq("sessionId", session.sessionId).eq("role", role),
            )
            .collect(),
        ),
      ),
    );

    const viewerTickets = await ctx.db
      .query("relayTicket")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect();
    const relayTickets = new Map(
      [...sessionTicketGroups.flat(), ...viewerTickets].map((ticket) => [
        String(ticket._id),
        ticket,
      ]),
    );

    const onboardingRows = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect();
    const rateLimits = await ctx.db.query("rateLimit").collect();
    const userRateLimits = rateLimits.filter((row) => row.key.includes(`user:${args.userId}`));

    await Promise.all([
      ...relayTickets.values().map((ticket) => ctx.db.delete(ticket._id)),
      ...onboardingRows.map((row) => ctx.db.delete(row._id)),
      ...userRateLimits.map((row) => ctx.db.delete(row._id)),
      ...sessions.map((session) => ctx.db.delete(session._id)),
    ]);

    return {
      sessions: sessions.length,
      onboardingRows: onboardingRows.length,
      relayTickets: relayTickets.size,
    };
  },
});

export const { onDelete } = authComponent.triggersApi();
