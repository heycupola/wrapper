import type { Metadata } from "next";
import { IosViewerCta } from "../../../components/ios-viewer-cta";
import { getToken } from "../../../lib/auth-server";
import { getDashboardBillingState } from "../../../lib/dashboard-server";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardBillingActions } from "./billing-client";
import { PlanCard } from "./plan-card";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage Wrapper billing and Pro checkout.",
  robots: { index: false, follow: false },
};

const FREE_FEATURES = [
  "Wrap zsh, bash, and fish",
  "Attach from the same computer",
  "Sessions stay on your machine",
] as const;

const PRO_FEATURES = [
  "Everything in Free",
  "Attach from another device",
  "Share a session, revoke anytime",
  "iPhone viewer app",
] as const;

export default async function DashboardBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string | string[] }>;
}) {
  const token = await getToken();
  if (!token) return null;

  const params = await searchParams;
  const upgraded = Array.isArray(params.upgraded) ? params.upgraded[0] : params.upgraded;
  const billing = await getDashboardBillingState(token);
  const canManageBilling = billing?.canManageBilling === true || upgraded === "1";
  const plan = billing?.plan === "pro" || upgraded === "1" ? "pro" : "free";

  return (
    <>
      <DashboardPageHeader
        title="Billing"
        description="Open secure billing controls or start a Wrapper Pro checkout."
      />

      <div className="dashboardBillingGrid">
        <PlanCard
          name="Free"
          label={plan === "free" ? "Current plan" : "Included"}
          price="$0"
          period="forever"
          summary="Your shell, on this machine."
          features={FREE_FEATURES}
        />
        <PlanCard
          name="Pro"
          label={plan === "pro" ? "Current plan" : "Remote access"}
          price="$20"
          period="/ month"
          summary="Your shell, from another device."
          features={PRO_FEATURES}
          highlighted
        >
          <IosViewerCta variant="text" />
        </PlanCard>
      </div>

      <DashboardBillingActions token={token} plan={plan} canManageBilling={canManageBilling} />

      {canManageBilling ? (
        <aside className="dashboardNotice">
          <strong>Billing provider is the source of truth</strong>
          <p>
            The secure billing portal shows invoices, payment details, current subscription state,
            and cancellation timing.
          </p>
        </aside>
      ) : null}
    </>
  );
}
