import { v } from "convex/values";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import { components } from "./_generated/api";
import { type ActionCtx, internalAction, internalMutation } from "./_generated/server";
import { deleteAllPaginated, deleteAuthRecordsForUser } from "./lib/accountDeletion.ts";
import { createLogger } from "./lib/logger.ts";

const log = createLogger("apple-notifications");
const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

const dispositionValidator = v.union(
  v.literal("ignored"),
  v.literal("account_not_found"),
  v.literal("invalidate_apple"),
  v.literal("unlink_apple"),
  v.literal("delete_user"),
);

type AppleEventDisposition =
  | "ignored"
  | "account_not_found"
  | "invalidate_apple"
  | "unlink_apple"
  | "delete_user";

type ClaimedEvent = {
  disposition?: AppleEventDisposition;
  status: "pending" | "processed";
  userId?: string;
};

type ClaimEventArgs = {
  eventIdHash: string;
  eventType: string;
  subjectHash: string;
};
type SetEventPlanArgs = {
  disposition: AppleEventDisposition;
  eventIdHash: string;
  userId?: string;
};

const claimEventRef = makeFunctionReference<"mutation", ClaimEventArgs, ClaimedEvent>(
  "appleNotifications:claimEvent",
) as unknown as FunctionReference<"mutation", "internal", ClaimEventArgs, ClaimedEvent>;
const setEventPlanRef = makeFunctionReference<"mutation", SetEventPlanArgs, ClaimedEvent>(
  "appleNotifications:setEventPlan",
) as unknown as FunctionReference<"mutation", "internal", SetEventPlanArgs, ClaimedEvent>;
const completeEventRef = makeFunctionReference<"mutation", { eventIdHash: string }, null>(
  "appleNotifications:completeEvent",
) as unknown as FunctionReference<"mutation", "internal", { eventIdHash: string }, null>;
const deleteOwnedDataRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { onboardingRows: number; relayTickets: number; sessions: number }
>("account:deleteOwnedData") as unknown as FunctionReference<
  "mutation",
  "internal",
  { userId: string },
  { onboardingRows: number; relayTickets: number; sessions: number }
>;
const queueBillingCustomerDeletionRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { queued: boolean }
>("account:queueBillingCustomerDeletion") as unknown as FunctionReference<
  "mutation",
  "internal",
  { userId: string },
  { queued: boolean }
>;

export const claimEvent = internalMutation({
  args: {
    eventIdHash: v.string(),
    eventType: v.string(),
    subjectHash: v.string(),
  },
  handler: async (ctx, args): Promise<ClaimedEvent> => {
    const existing = await ctx.db
      .query("appleAccountEvent")
      .withIndex("by_event_id", (query) => query.eq("eventIdHash", args.eventIdHash))
      .unique();
    if (existing) {
      return {
        ...(existing.disposition === undefined ? {} : { disposition: existing.disposition }),
        status: existing.status,
        ...(existing.userId === undefined ? {} : { userId: existing.userId }),
      };
    }

    const now = Date.now();
    await ctx.db.insert("appleAccountEvent", {
      eventIdHash: args.eventIdHash,
      eventType: args.eventType,
      status: "pending",
      subjectHash: args.subjectHash,
      createdAt: now,
      updatedAt: now,
    });
    return { status: "pending" };
  },
});

export const setEventPlan = internalMutation({
  args: {
    disposition: dispositionValidator,
    eventIdHash: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ClaimedEvent> => {
    const event = await ctx.db
      .query("appleAccountEvent")
      .withIndex("by_event_id", (query) => query.eq("eventIdHash", args.eventIdHash))
      .unique();
    if (!event) throw new Error("Apple notification event was not claimed");
    if (event.status === "processed" || event.disposition !== undefined) {
      return {
        ...(event.disposition === undefined ? {} : { disposition: event.disposition }),
        status: event.status,
        ...(event.userId === undefined ? {} : { userId: event.userId }),
      };
    }

    await ctx.db.patch(event._id, {
      disposition: args.disposition,
      updatedAt: Date.now(),
      ...(args.userId === undefined ? {} : { userId: args.userId }),
    });
    return {
      disposition: args.disposition,
      status: "pending",
      ...(args.userId === undefined ? {} : { userId: args.userId }),
    };
  },
});

export const completeEvent = internalMutation({
  args: {
    eventIdHash: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("appleAccountEvent")
      .withIndex("by_event_id", (query) => query.eq("eventIdHash", args.eventIdHash))
      .unique();
    if (!event || event.status === "processed") return null;

    const now = Date.now();
    await ctx.db.patch(event._id, {
      processedAt: now,
      status: "processed",
      updatedAt: now,
      userId: undefined,
    });
    return null;
  },
});

export const cleanupProcessedEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const before = Date.now() - EVENT_RETENTION_MS;
    const expired = await ctx.db
      .query("appleAccountEvent")
      .withIndex("by_created_at", (query) => query.lt("createdAt", before))
      .take(500);
    await Promise.all(expired.map((event) => ctx.db.delete(event._id)));
    return { deleted: expired.length, hasMore: expired.length === 500 };
  },
});

export const processAccountEvent = internalAction({
  args: {
    event: v.object({
      eventTime: v.optional(v.number()),
      sub: v.string(),
      type: v.string(),
    }),
    jti: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ disposition: AppleEventDisposition; replayed: boolean }> => {
    const eventIdHash = await sha256(`${args.jti}\0${args.event.type}\0${args.event.sub}`);
    const subjectHash = await sha256(args.event.sub);
    let claimed: ClaimedEvent = await ctx.runMutation(claimEventRef, {
      eventIdHash,
      eventType: args.event.type,
      subjectHash,
    });
    if (claimed.status === "processed") {
      return { disposition: claimed.disposition ?? "ignored", replayed: true };
    }

    if (!claimed.disposition) {
      claimed = await planEvent(ctx, args.event, eventIdHash);
    }
    const disposition = claimed.disposition ?? "ignored";
    if (claimed.userId) {
      await executeDisposition(ctx, disposition, claimed.userId);
    }
    await ctx.runMutation(completeEventRef, { eventIdHash });
    log.info("Apple account-change notification processed", {
      disposition,
      eventType: args.event.type,
    });
    return { disposition, replayed: false };
  },
});

async function planEvent(
  ctx: ActionCtx,
  event: { sub: string; type: string },
  eventIdHash: string,
): Promise<ClaimedEvent> {
  if (!["consent-revoked", "account-delete", "account-deleted"].includes(event.type)) {
    return await ctx.runMutation(setEventPlanRef, {
      disposition: "ignored",
      eventIdHash,
    });
  }

  const appleAccount = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "accountId", operator: "eq", value: event.sub },
      { field: "providerId", operator: "eq", value: "apple" },
    ],
  })) as { userId: string } | null;
  if (!appleAccount) {
    return await ctx.runMutation(setEventPlanRef, {
      disposition: "account_not_found",
      eventIdHash,
    });
  }

  if (event.type === "consent-revoked") {
    return await ctx.runMutation(setEventPlanRef, {
      disposition: "invalidate_apple",
      eventIdHash,
      userId: appleAccount.userId,
    });
  }

  const accounts = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    paginationOpts: { cursor: null, numItems: 100 },
    where: [{ field: "userId", operator: "eq", value: appleAccount.userId }],
  })) as {
    isDone: boolean;
    page: Array<{ providerId: string }>;
  };
  const hasAnotherCredential =
    !accounts.isDone || accounts.page.some((account) => account.providerId !== "apple");
  return await ctx.runMutation(setEventPlanRef, {
    disposition: hasAnotherCredential ? "unlink_apple" : "delete_user",
    eventIdHash,
    userId: appleAccount.userId,
  });
}

async function executeDisposition(
  ctx: ActionCtx,
  disposition: AppleEventDisposition,
  userId: string,
): Promise<void> {
  switch (disposition) {
    case "invalidate_apple":
      await Promise.all([
        deleteSessionsForUser(ctx, userId),
        deleteDeviceCodesForUser(ctx, userId),
        clearAppleTokens(ctx, userId),
      ]);
      return;
    case "unlink_apple":
      await Promise.all([
        deleteSessionsForUser(ctx, userId),
        deleteDeviceCodesForUser(ctx, userId),
        deleteAppleAccounts(ctx, userId),
      ]);
      return;
    case "delete_user":
      await deleteAppleOnlyUser(ctx, userId);
      return;
    case "account_not_found":
    case "ignored":
      return;
  }
}

async function clearAppleTokens(ctx: ActionCtx, userId: string): Promise<void> {
  await ctx.runMutation(components.betterAuth.adapter.updateMany, {
    input: {
      model: "account",
      update: {
        accessToken: null,
        accessTokenExpiresAt: null,
        idToken: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        updatedAt: Date.now(),
      },
      where: [
        { field: "userId", operator: "eq", value: userId },
        { field: "providerId", operator: "eq", value: "apple" },
      ],
    },
    paginationOpts: { cursor: null, numItems: 100 },
  });
}

async function deleteSessionsForUser(ctx: ActionCtx, userId: string): Promise<number> {
  return await deleteAllPaginated((paginationOpts) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "session",
        where: [{ field: "userId", operator: "eq", value: userId }],
      },
      paginationOpts,
    }),
  );
}

async function deleteDeviceCodesForUser(ctx: ActionCtx, userId: string): Promise<number> {
  return await deleteAllPaginated((paginationOpts) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "deviceCode",
        where: [{ field: "userId", operator: "eq", value: userId }],
      },
      paginationOpts,
    }),
  );
}

async function deleteAppleAccounts(ctx: ActionCtx, userId: string): Promise<number> {
  return await deleteAllPaginated((paginationOpts) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "account",
        where: [
          { field: "userId", operator: "eq", value: userId },
          { field: "providerId", operator: "eq", value: "apple" },
        ],
      },
      paginationOpts,
    }),
  );
}

async function deleteAppleOnlyUser(ctx: ActionCtx, userId: string): Promise<void> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", operator: "eq", value: userId }],
  })) as { email: string } | null;

  await ctx.runMutation(deleteOwnedDataRef, { userId });
  await ctx.runMutation(queueBillingCustomerDeletionRef, { userId });
  await deleteSessionsForUser(ctx, userId);
  if (!user) return;

  await deleteAuthRecordsForUser({
    deletePage: async (request, paginationOpts) =>
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: request,
        paginationOpts,
      }),
    email: user.email,
    userId,
  });
  await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
    input: {
      model: "user",
      where: [{ field: "_id", operator: "eq", value: userId }],
    },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
