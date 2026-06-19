import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { deviceAuthorization, lastLoginMethod } from "better-auth/plugins";
import authSchema from "./betterAuth/schema";

const isDevEnvironment = process.env.ENVIRONMENT === "development";

const siteUrl =
  process.env.SITE_URL || (isDevEnvironment ? "http://localhost:3000" : "https://wrapper.sh");

const DEV_AUTH_SECRET = "wrapper-local-dev-secret-change-me";

function resolveBetterAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
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

  return betterAuth({
    baseURL: siteUrl,
    // Resolved lazily (not at module load) so Convex's push/analyze phase
    // never evaluates it without the deployment env present.
    secret: resolveBetterAuthSecret(),
    database: authComponent.adapter(ctx),
    socialProviders,
    plugins: [
      convex({ authConfig }),
      deviceAuthorization(),
      lastLoginMethod({
        storeInDatabase: true,
      }),
    ],
  });
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
