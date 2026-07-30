import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Delete a limiter row only if it has not been renewed into a newer window. */
export const remove = internalMutation({
  args: {
    key: v.string(),
    expectedResetAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("rateLimit")
      .withIndex("by_key", (query) => query.eq("key", args.key))
      .first();
    if (!row || row.resetAt !== args.expectedResetAt || row.resetAt > Date.now()) {
      return { deleted: false };
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});
