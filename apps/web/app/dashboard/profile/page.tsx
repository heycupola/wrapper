import type { Metadata } from "next";
import { getToken } from "../../../lib/auth-server";
import { getDashboardBillingState } from "../../../lib/dashboard-server";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardProfile } from "./profile-client";

export const metadata: Metadata = {
  title: "Profile",
  description: "Review the identity attached to your Wrapper profile.",
  robots: { index: false, follow: false },
};

export default async function DashboardProfilePage() {
  const token = await getToken();
  const billing = token ? await getDashboardBillingState(token) : null;

  return (
    <>
      <DashboardPageHeader
        title="Profile"
        description="The identity currently attached to Wrapper and its authenticated services."
      />
      <DashboardProfile plan={billing?.plan ?? null} />
    </>
  );
}
