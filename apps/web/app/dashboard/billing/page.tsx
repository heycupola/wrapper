import type { Metadata } from "next";
import { getToken } from "../../../lib/auth-server";
import { getDashboardBillingState } from "../../../lib/dashboard-server";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardBilling } from "./billing-client";

export const metadata: Metadata = {
  title: "Billing",
  description: "Choose yearly or monthly Pro, or open the billing portal.",
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
  const plan = billing?.plan === "pro" || upgraded === "1" ? "pro" : "free";

  return (
    <>
      <DashboardPageHeader
        title="Billing"
        description="Yearly is $99. Monthly is $15. Upgrade when a session needs to leave this machine."
        analyticsPage="billing"
      />

      <DashboardBilling token={token} plan={plan} canManageBilling={canManageBilling} />

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
