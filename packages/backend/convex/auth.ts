import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { bearer, deviceAuthorization, lastLoginMethod } from "better-auth/plugins";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import authSchema from "./betterAuth/schema";
import { deleteAuthRecordsForUser } from "./lib/accountDeletion.ts";
import { revokeAppleCredential } from "./lib/appleRevocation.ts";
import { createLogger } from "./lib/logger.ts";

const isDevEnvironment = process.env.ENVIRONMENT === "development";
const log = createLogger("auth");

const siteUrl =
  process.env.SITE_URL || (isDevEnvironment ? "http://localhost:3000" : "https://www.wrapper.sh");

const DEV_AUTH_SECRET = "wrapper-local-dev-secret-change-me";
const deleteOwnedDataRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { sessions: number; onboardingRows: number; relayTickets: number }
>("account:deleteOwnedData");
const queueBillingCustomerDeletionRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { queued: boolean }
>("account:queueBillingCustomerDeletion");
const sendWelcomeEmailRef = makeFunctionReference<
  "action",
  { userId: string },
  { success: boolean }
>("user:_sendWelcomeEmail") as unknown as FunctionReference<
  "action",
  "internal",
  { userId: string },
  { success: boolean }
>;
const sendAccountDeletedEmailRef = makeFunctionReference<
  "action",
  { to: string; userName: string; sessionsDeleted: number; ticketsRevoked: number },
  { success: boolean }
>("user:_sendAccountDeletedEmail") as unknown as FunctionReference<
  "action",
  "internal",
  { to: string; userName: string; sessionsDeleted: number; ticketsRevoked: number },
  { success: boolean }
>;
const authOnCreateRef = makeFunctionReference<"mutation", { doc: unknown; model: string }, null>(
  "account:onCreate",
) as unknown as FunctionReference<"mutation", "internal", { doc: unknown; model: string }, null>;
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
      onCreate: async (ctx, user) => {
        await ctx.scheduler.runAfter(0, sendWelcomeEmailRef, {
          userId: user._id,
        });
      },
      onDelete: async (ctx, user) => {
        const counts = await ctx.runMutation(deleteOwnedDataRef, { userId: user._id });
        if (user.email) {
          try {
            await ctx.scheduler.runAfter(0, sendAccountDeletedEmailRef, {
              to: user.email,
              userName: user.name || "there",
              sessionsDeleted: counts.sessions,
              ticketsRevoked: counts.relayTickets,
            });
          } catch {
            log.error("Account deletion email could not be queued", {
              errorCode: "account_deleted_email_queue_failed",
            });
          }
        }
        try {
          const billingCleanup = await ctx.runMutation(queueBillingCustomerDeletionRef, {
            userId: user._id,
          });
          if (!billingCleanup.queued) {
            log.error(
              "Billing customer deletion was not queued; local account deletion will continue",
              { errorCode: "billing_cleanup_queue_failed" },
            );
          }
        } catch {
          log.error(
            "Billing customer deletion could not be queued; local account deletion will continue",
            { errorCode: "billing_cleanup_queue_failed" },
          );
        }
      },
    },
  },
  authFunctions: {
    onCreate: authOnCreateRef,
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
    trustedOrigins: socialProviders.apple ? ["https://appleid.apple.com"] : [],
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          if (!("runMutation" in ctx) || !("runQuery" in ctx)) {
            throw new Error("Account deletion requires an action context");
          }
          const appleAccount = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model: "account",
            where: [
              { field: "userId", operator: "eq", value: user.id },
              { field: "providerId", operator: "eq", value: "apple" },
            ],
          })) as {
            accessToken?: string | null;
            refreshToken?: string | null;
          } | null;
          await deleteAuthRecordsForUser({
            deletePage: async (request, paginationOpts) =>
              await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
                input: request,
                paginationOpts,
              }),
            email: user.email,
            userId: user.id,
          });
          if (appleAccount) {
            try {
              const result = await revokeAppleCredential({
                accessToken: appleAccount.accessToken,
                clientId: process.env.APPLE_CLIENT_ID ?? "",
                clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
                refreshToken: appleAccount.refreshToken,
              });
              if (result.status === "missing_token") {
                log.warn(
                  "[auth] Apple account has no revocable token; continuing local account deletion",
                );
              }
            } catch {
              log.error("Apple token revocation failed; local deletion will continue", {
                errorCode: "apple_revocation_failed",
              });
            }
          }
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
