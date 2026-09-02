import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "../../components/auth-shell";
import { SiteHeader } from "../../components/landing-header";
import { getAuthProviderAvailability } from "../../lib/auth-providers";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { getDashboardOnboardingState } from "../../lib/dashboard-server";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardSignIn } from "./dashboard-sign-in";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  const signedIn = authenticated && Boolean(token);
  const providers = getAuthProviderAvailability(process.env);

  if (signedIn && token) {
    const onboarding = await getDashboardOnboardingState(token);
    if (onboarding?.needsOnboarding) redirect("/onboarding");
  }

  if (!signedIn) {
    return (
      <AuthShell
        title="Sign in"
        description="Continue with the account on your Wrapper profile."
        size="narrow"
        showHeaderAction={false}
        showFooter={false}
      >
        <DashboardSignIn appleEnabled={providers.apple} />
      </AuthShell>
    );
  }

  return (
    <div className="dashboardShell">
      <SiteHeader showAction={false} />
      <main id="main-content" className="dashboardMain" tabIndex={-1}>
        <DashboardSidebar />
        <div className="dashboardWorkspace">{children}</div>
      </main>
    </div>
  );
}
