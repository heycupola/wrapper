import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/landing-header";
import { getAuthProviderAvailability } from "../../lib/auth-providers";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { getDashboardOnboardingState } from "../../lib/dashboard-server";
import { DashboardPageHeader } from "./dashboard-page-header";
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

  return (
    <div className="dashboardShell">
      <SiteHeader showAction={false} />
      <main
        id="main-content"
        className={signedIn ? "dashboardMain" : "dashboardMain dashboardMainSignedOut"}
        tabIndex={-1}
      >
        {signedIn ? <DashboardSidebar /> : null}
        <section className="dashboardWorkspace">
          {signedIn ? (
            children
          ) : (
            <>
              <DashboardPageHeader
                title="Sign in"
                description="Use the provider linked to your Wrapper profile."
              />
              <DashboardSignIn appleEnabled={providers.apple} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
