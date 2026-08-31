import type { Metadata } from "next";
import { PlanMoment } from "../../../components/plan-moment";

export const metadata: Metadata = {
  title: "Pro unlocked",
  description: "Wrapper Pro is active on this account.",
  robots: { index: false, follow: false },
};

export default function PlanUpgradedPage() {
  return <PlanMoment variant="upgraded" />;
}
