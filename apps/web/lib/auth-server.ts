import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

if (!convexUrl || !convexSiteUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL or NEXT_PUBLIC_CONVEX_SITE_URL. Configure both for Better Auth wiring.",
  );
}

const authServer = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});

export const handler = authServer.handler;
export const isAuthenticated = authServer.isAuthenticated;
export const getToken = authServer.getToken;
