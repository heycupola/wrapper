import { v } from "convex/values";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import { internalAction, internalMutation } from "./_generated/server";
import { initAutumn } from "./autumn.ts";
import { authComponent } from "./auth";
import {
  billingDeleteFailureLogData,
  classifyBillingDeleteResult,
  getBillingDeleteRetryDecision,
  toSafeBillingErrorCode,
} from "./lib/accountDeletion.ts";
import { createLogger } from "./lib/logger.ts";
import { getUserRateLimitKeys } from "./lib/rateLimit.ts";

const log = createLogger("account");

type BillingDeleteWorkerResult = {
  alreadyAbsent: boolean;
  attempt: number;
  retryScheduled: boolean;
  succeeded: boolean;
};

const deleteBillingCustomerRef = makeFunctionReference<
  "action",
  { attempt: number; userId: string },
  BillingDeleteWorkerResult
>("account:deleteBillingCustomer") as unknown as FunctionReference<
  "action",
  "internal",
  { attempt: number; userId: string },
  BillingDeleteWorkerResult
>;

export const queueBillingCustomerDeletion = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.scheduler.runAfter(0, deleteBillingCustomerRef, {
        attempt: 1,
        userId: args.userId,
      });
      return { queued: true };
    } catch (error) {
      log.error(
        "Unable to queue billing customer deletion; local account deletion will continue",
        billingDeleteFailureLogData({ attempt: 1, error }),
      );
      return { queued: false };
    }
  },
});

export const deleteBillingCustomer = internalAction({
  args: {
    attempt: v.number(),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<BillingDeleteWorkerResult> => {
    const deferFailure = async (
      error: unknown,
      statusCode?: number,
    ): Promise<BillingDeleteWorkerResult> => {
      const retry = getBillingDeleteRetryDecision(args.attempt);
      if (!retry.shouldRetry) {
        log.error(
          "Billing customer deletion retries exhausted",
          billingDeleteFailureLogData({
            attempt: args.attempt,
            error,
            statusCode,
          }),
        );
        return {
          alreadyAbsent: false,
          attempt: args.attempt,
          retryScheduled: false,
          succeeded: false,
        };
      }

      try {
        await ctx.scheduler.runAfter(retry.delayMs, deleteBillingCustomerRef, {
          attempt: retry.nextAttempt,
          userId: args.userId,
        });
      } catch (scheduleError) {
        log.error("Unable to schedule billing customer deletion retry", {
          ...billingDeleteFailureLogData({
            attempt: args.attempt,
            error,
            statusCode,
          }),
          schedulerErrorCode: toSafeBillingErrorCode(scheduleError),
        });
        return {
          alreadyAbsent: false,
          attempt: args.attempt,
          retryScheduled: false,
          succeeded: false,
        };
      }

      log.warn(
        "Billing customer deletion deferred",
        billingDeleteFailureLogData({
          attempt: args.attempt,
          error,
          retryDelayMs: retry.delayMs,
          statusCode,
        }),
      );
      return {
        alreadyAbsent: false,
        attempt: args.attempt,
        retryScheduled: true,
        succeeded: false,
      };
    };

    try {
      const autumn = initAutumn({ customerId: args.userId });
      const result = await autumn.customers.delete(ctx);
      const outcome = classifyBillingDeleteResult(result);
      if (outcome === "retry") {
        return await deferFailure(result.error, result.statusCode);
      }

      log.info("Billing customer deletion completed", {
        attempt: args.attempt,
        outcome,
      });
      return {
        alreadyAbsent: outcome === "already_absent",
        attempt: args.attempt,
        retryScheduled: false,
        succeeded: true,
      };
    } catch (error) {
      return await deferFailure(error);
    }
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
    const rateLimitGroups = await Promise.all(
      getUserRateLimitKeys(args.userId).map((key) =>
        ctx.db
          .query("rateLimit")
          .withIndex("by_key", (query) => query.eq("key", key))
          .collect(),
      ),
    );
    const userRateLimits = rateLimitGroups.flat();

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
