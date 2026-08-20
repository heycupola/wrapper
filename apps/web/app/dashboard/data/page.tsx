import type { Metadata } from "next";
import Link from "next/link";
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
            <li>Host-session metadata required to operate active sessions</li>
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
          <Link className="textAction" href="/privacy-policy">
            Read the privacy policy
          </Link>
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
        <Link className="textAction" href="/support">
          Contact support
        </Link>
      </section>

      <DashboardDeletion />
    </>
  );
}
