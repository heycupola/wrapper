import { redirect } from "next/navigation";
import { getToken } from "../../../lib/auth-server";
import { getDashboardBillingState } from "../../../lib/dashboard-server";

export default async function PlanReturnedPage() {
  const token = await getToken();
  if (!token) return null;

  const billing = await getDashboardBillingState(token);
  if (billing?.plan === "free") redirect("/plan/cancelled");
  redirect("/dashboard/billing");
}
