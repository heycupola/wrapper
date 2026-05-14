import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getToken, isAuthenticated } from "../lib/auth-server";
import { HorizontalLanding } from "../components/horizontal-landing";

type OnboardingState = {
  needsOnboarding: boolean;
};

const getOnboardingStateRef = makeFunctionReference<
  "query",
  Record<string, never>,
  OnboardingState
>("onboarding:getState");

export default async function Home() {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  if (authenticated && token) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const client = new ConvexHttpClient(convexUrl);
      client.setAuth(token);
      try {
        const state = await client.query(getOnboardingStateRef, {});
        if (state.needsOnboarding) {
          redirect("/onboarding");
        }
      } catch {
        // Fallback to landing page if onboarding query fails.
      }
    }
  }

  return <HorizontalLanding />;
}
