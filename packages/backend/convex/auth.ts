import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { bearer, deviceAuthorization, lastLoginMethod } from "better-auth/plugins";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import authSchema from "./betterAuth/schema";

const isDevEnvironment = process.env.ENVIRONMENT === "development";

const siteUrl =
  process.env.SITE_URL || (isDevEnvironment ? "http://localhost:3000" : "https://wrapper.sh");

const DEV_AUTH_SECRET = "wrapper-local-dev-secret-change-me";
const deleteOwnedDataRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { sessions: number; onboardingRows: number; relayTickets: number }
>("account:deleteOwnedData");
const deleteBillingCustomerRef = makeFunctionReference<
  "action",
  { userId: string; email?: string; name?: string },
  { succeeded: boolean }
>("account:deleteBillingCustomer");
const authOnDeleteRef = makeFunctionReference<"mutation", { doc: unknown; model: string }, null>(
  "account:onDelete",
) as unknown as FunctionReference<"mutation", "internal", { doc: unknown; model: string }, null>;

function resolveBetterAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;

  if (isDevEnvironment) {
    console.warn(
      "[auth] BETTER_AUTH_SECRET is not set; using a stable development-only default. " +
        "Never run production without a real secret.",
    );
    return DEV_AUTH_SECRET;
  }

  // Outside development we must never fall back to a publicly known constant —
  // that would let anyone forge auth/session tokens and impersonate accounts.
  // A module-load throw is not viable: Convex's push/analyze phase evaluates
  // this module without deployment env vars, which would break codegen/deploy.
  // Instead, fail *closed* with an ephemeral per-instance secret: a
  // misconfigured deployment can't validate any session (forcing the operator
  // to notice and set the real secret) and is never forgeable with a known key.
  console.error(
    "[auth] BETTER_AUTH_SECRET is not set outside development. Generating an ephemeral " +
      "secret; sessions will not persist or validate until BETTER_AUTH_SECRET is configured.",
  );
  return `ephemeral-${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
  triggers: {
    user: {
      onDelete: async (ctx, user) => {
        await ctx.runMutation(deleteOwnedDataRef, { userId: user._id });
      },
    },
  },
  authFunctions: {
    onDelete: authOnDeleteRef,
  },
}) as ReturnType<typeof createClient<DataModel>>;

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    baseURL: siteUrl,
    // Resolved lazily (not at module load) so Convex's push/analyze phase
    // never evaluates it without the deployment env present.
    secret: resolveBetterAuthSecret(),
    database: authComponent.adapter(ctx),
    socialProviders,
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          if (!("runAction" in ctx) || !("runMutation" in ctx)) {
            throw new Error("Account deletion requires an action context");
          }
          await ctx.runAction(deleteBillingCustomerRef, {
            userId: user.id,
            email: user.email,
            name: user.name,
          });
          const paginationOpts = { numItems: 100, cursor: null };
          await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
            input: {
              model: "account",
              where: [{ field: "userId", operator: "eq", value: user.id }],
            },
            paginationOpts,
          });
          await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
            input: {
              model: "deviceCode",
              where: [{ field: "userId", operator: "eq", value: user.id }],
            },
            paginationOpts,
          });
          await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
            input: {
              model: "verification",
              where: [{ field: "value", operator: "eq", value: user.id }],
            },
            paginationOpts,
          });
          await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
            input: {
              model: "verification",
              where: [{ field: "identifier", operator: "eq", value: user.email }],
            },
            paginationOpts,
          });
        },
      },
    },
    plugins: [
      convex({ authConfig }),
      deviceAuthorization(),
      // Lets the CLI present its device session token as `Authorization:
      // Bearer <token>` to exchange it for a Convex JWT at /convex/token.
      bearer(),
      lastLoginMethod({
        storeInDatabase: true,
      }),
    ],
  });
};
