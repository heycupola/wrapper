import type { Autumn } from "@useautumn/convex";
import { customAction, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { action, mutation, query } from "../_generated/server";
import { initAutumn } from "../autumn.ts";
import { createError, ErrorCode } from "./errors.ts";
import { ErrorSeverity } from "./types.ts";

type AuthenticatedCtx = {
  userId: string;
  email: string | undefined;
  name: string | undefined;
};

async function requireIdentity(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<AuthenticatedCtx> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw createError({
      code: ErrorCode.UNAUTHORIZED,
      message: "Please sign in",
      severity: ErrorSeverity.Low,
    });
  }

  return {
    userId: identity.subject,
    email: identity.email,
    name: identity.name,
  };
}

export const protectedQuery = customQuery(query, {
  args: {},
  input: async (
    ctx: QueryCtx,
    args: Record<string, unknown>,
  ): Promise<{
    ctx: AuthenticatedCtx;
    args: Record<string, unknown>;
  }> => {
    const identity = await requireIdentity(ctx);
    return {
      ctx: identity,
      args,
    };
  },
});

export const protectedMutation = customMutation(mutation, {
  args: {},
  input: async (
    ctx: MutationCtx,
    args: Record<string, unknown>,
  ): Promise<{
    ctx: AuthenticatedCtx;
    args: Record<string, unknown>;
  }> => {
    const identity = await requireIdentity(ctx);
    return {
      ctx: identity,
      args,
    };
  },
});

export const protectedAction = customAction(action, {
  args: {},
  input: async (
    ctx: ActionCtx,
    args: Record<string, unknown>,
  ): Promise<{
    ctx: AuthenticatedCtx & { autumn: Autumn };
    args: Record<string, unknown>;
  }> => {
    const identity = await requireIdentity(ctx);
    const autumn = initAutumn({
      customerId: identity.userId,
      customerData: {
        email: identity.email,
        name: identity.name,
      },
    });

    return {
      ctx: {
        autumn,
        ...identity,
      },
      args,
    };
  },
});

export const publicQuery = query;
export const publicMutation = mutation;
