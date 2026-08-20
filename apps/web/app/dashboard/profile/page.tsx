import type { Metadata } from "next";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardProfile } from "./profile-client";

export const metadata: Metadata = {
  title: "Profile",
  description: "Review the identity attached to your Wrapper profile.",
  robots: { index: false, follow: false },
};

export default function DashboardProfilePage() {
  return (
    <>
      <DashboardPageHeader
        title="Profile"
        description="The identity currently attached to Wrapper and its authenticated services."
      />
      <DashboardProfile />
    </>
  );
}
