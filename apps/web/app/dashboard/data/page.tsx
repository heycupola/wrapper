import type { Metadata } from "next";
import { Button } from "../../../components/ui/button";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardDeletion } from "./data-client";

export const metadata: Metadata = {
  title: "Data & deletion",
  description: "Review Wrapper data handling and permanent deletion controls.",
  robots: { index: false, follow: false },
};

export default function DashboardDataPage() {
  return (
    <>
      <DashboardPageHeader
        title="Data & deletion"
        description="Understand what Wrapper stores and permanently remove your profile and owned data."
        analyticsPage="data"
      />

      <div className="dashboardDataGrid">
        <section className="dashboardPanel" aria-labelledby="stored-data-title">
          <div className="dashboardPanelHeader">
            <div>
              <span className="dashboardPanelLabel">Stored</span>
              <h2 id="stored-data-title">Service metadata</h2>
            </div>
          </div>
          <ul className="dashboardFeatureList">
            <li>Profile and authentication metadata</li>
            <li>Onboarding progress and optional survey context</li>
            <li>Host-session metadata for sessions you have explicitly shared</li>
            <li>Billing records managed by Autumn and Stripe</li>
          </ul>
        </section>

        <section className="dashboardPanel" aria-labelledby="local-data-title">
          <div className="dashboardPanelHeader">
            <div>
              <span className="dashboardPanelLabel">Local</span>
              <h2 id="local-data-title">Terminal content</h2>
            </div>
          </div>
          <p className="dashboardPanelCopy">
            Unshared terminal traffic stays on the host. Sharing is initiated and revoked from the
            shell you control.
          </p>
          <Button href="/privacy-policy">Read the privacy policy</Button>
        </section>
      </div>

      <section className="dashboardActionPanel" aria-labelledby="privacy-request-title">
        <div>
          <h2 id="privacy-request-title">Privacy request</h2>
          <p>
            Contact support for access, correction, export, or another privacy request that is not
            available as a self-service control.
          </p>
        </div>
        <Button href="/support">Contact support</Button>
      </section>

      <DashboardDeletion />
    </>
  );
}
