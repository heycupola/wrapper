import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { UpgradePro } from "../../components/upgrade-pro";
import { OnboardingClient } from "./onboarding-client";

type OnboardingState = {
  needsOnboarding: boolean;
  status: "in_progress" | "completed";
  completedProfile: boolean;
  connectedCli: boolean;
  sharedFirstSession: boolean;
  source?: string | null;
  sourceOther?: string | null;
  teamSize?: string | null;
  completedAt?: number | null;
};

const getOnboardingStateRef = makeFunctionReference<
  "query",
  Record<string, never>,
  OnboardingState
>("onboarding:getState");

export default async function OnboardingPage() {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  if (!authenticated || !token) redirect("/oauth/authorize");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return (
      <div className="page">
        <main className="content">
          <h1 className="authTitle">Onboarding</h1>
          <p className="authError">Missing NEXT_PUBLIC_CONVEX_URL</p>
        </main>
      </div>
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const state = await client.query(getOnboardingStateRef, {});

  return (
    <div className="page">
      <main className="content">
        <h1 className="authTitle">Welcome to Wrapper</h1>
        <p className="description">
          Complete these steps once to unlock your full CLI and relay workflow.
        </p>
        <OnboardingClient token={token} initialState={state} />
        <UpgradePro token={token} />
      </main>
    </div>
  );
}
