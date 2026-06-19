import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { deviceAuthorization, lastLoginMethod } from "better-auth/plugins";
import authSchema from "./betterAuth/schema";

const siteUrl =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://wrapper.sh");
const LOCAL_BETTER_AUTH_SECRET = "wrapper-local-dev-secret-change-me";
const betterAuthSecret = resolveBetterAuthSecret();

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
    secret: betterAuthSecret,
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

function resolveBetterAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;

  if (process.env.ENVIRONMENT === "development") {
    return LOCAL_BETTER_AUTH_SECRET;
  }

  throw new Error(
    "Missing BETTER_AUTH_SECRET. Set a strong Better Auth secret for non-development deployments.",
  );
}
