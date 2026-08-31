import type { Metadata } from "next";
import { PlanMoment } from "../../../components/plan-moment";

export const metadata: Metadata = {
  title: "Back on Free",
  description: "Wrapper Pro has been cancelled on this account.",
  robots: { index: false, follow: false },
};

export default function PlanCancelledPage() {
  return <PlanMoment variant="cancelled" />;
}
