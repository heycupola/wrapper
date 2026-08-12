import { Autumn } from "@useautumn/convex";
import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { createLogger } from "./lib/logger.ts";

const log = createLogger("autumn");
const autumnComponent = (components as unknown as { autumn: unknown }).autumn;

type AutumnContext = GenericActionCtx<DataModel>;
type AutumnIdentity = {
  customerId: string;
  customerData?: {
    name?: string | null;
    email?: string | null;
  };
};

const MAX_TRACK_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

function getAutumnSecretKey(): string {
  const key = process.env.AUTUMN_SECRET_KEY;
  if (!key) {
    log.warn("AUTUMN_SECRET_KEY is not configured");
    return "";
  }
  return key;
}

function computeBackoffMs(attemptCount: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** (attemptCount - 1), MAX_RETRY_DELAY_MS);
}

export const initAutumn = (identity: AutumnIdentity) =>
  new Autumn(autumnComponent as never, {
    secretKey: getAutumnSecretKey(),
    identify: async (_ctx: AutumnContext) => {
      return identity;
    },
  });

export const autumn = new Autumn(autumnComponent as never, {
  secretKey: getAutumnSecretKey(),
  identify: async (ctx: AutumnContext) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return {
      customerId: identity.subject,
      customerData: {
        name: identity.name as string,
        email: identity.email as string,
      },
    };
  },
});

// NOTE: attemptCount must start at 1 to ensure everything works correctly
export const _retryAutumnTracking = internalMutation({
  args: {
    identity: v.object({
      customerId: v.string(),
      customerData: v.optional(
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      ),
    }),
    projectId: v.string(),
    featureId: v.string(),
    value: v.number(),
    attemptCount: v.number(),
  },
  handler: async (ctx, args) => {
    const autumnClient = initAutumn(args.identity);

    try {
      await autumnClient.track(ctx, { featureId: args.featureId, value: args.value });
    } catch {
      if (args.attemptCount < MAX_TRACK_RETRIES) {
        const backoffMs = computeBackoffMs(args.attemptCount);
        await ctx.scheduler.runAfter(backoffMs, internal.autumn._retryAutumnTracking, {
          ...args,
          attemptCount: args.attemptCount + 1,
        });
      } else {
        log.error("Max retries exceeded for Autumn tracking", {
          projectId: args.projectId,
          featureId: args.featureId,
          customerId: args.identity.customerId,
        });
      }
    }
  },
});
