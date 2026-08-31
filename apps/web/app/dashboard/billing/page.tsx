import type { Metadata } from "next";
import { getToken } from "../../../lib/auth-server";
import { getDashboardBillingState } from "../../../lib/dashboard-server";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardBillingActions } from "./billing-client";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage Wrapper billing and Pro checkout.",
  robots: { index: false, follow: false },
};

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

  return (
    <>
      <DashboardPageHeader
        title="Billing"
        description="Open secure billing controls or start a Wrapper Pro checkout."
      />

      <div className="dashboardBillingGrid">
        <article className="dashboardPanel">
          <div className="dashboardPanelHeader">
            <div>
              <span className="dashboardPanelLabel">Included</span>
              <h2>Free</h2>
            </div>
            <strong className="dashboardPlanPrice">$0</strong>
          </div>
          <ul className="dashboardFeatureList">
            <li>Local wrap for zsh, bash, and fish</li>
            <li>Attach from this computer</li>
            <li>No subscription required</li>
          </ul>
        </article>

        <article className="dashboardPanel dashboardProPanel">
          <div className="dashboardPanelHeader">
            <div>
              <span className="dashboardPanelLabel">Remote access</span>
              <h2>Pro</h2>
            </div>
            <p className="dashboardPlanPrice">
              <strong>$20</strong>
              <span>/ month</span>
            </p>
          </div>
          <ul className="dashboardFeatureList">
            <li>Attach from another device</li>
            <li>WebRTC when available</li>
            <li>Authenticated relay fallback</li>
          </ul>
        </article>
      </div>

      <DashboardBillingActions token={token} canManageBilling={canManageBilling} />

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
