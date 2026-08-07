import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { AuthShell } from "../../components/auth-shell";
import { UpgradePro } from "../../components/upgrade-pro";
import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

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
      <AuthShell
        title="Get started"
        description="Connect the Wrapper CLI and prepare your first private terminal session."
      >
        <p className="authError" role="alert">
          Wrapper account services are temporarily unavailable.
        </p>
      </AuthShell>
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const state = await client.query(getOnboardingStateRef, {});

  return (
    <AuthShell
      title="Welcome to Wrapper"
      description="Connect the CLI, verify your local session, and share only when you are ready."
    >
      <OnboardingClient token={token} initialState={state} />
      <UpgradePro token={token} />
    </AuthShell>
  );
}
