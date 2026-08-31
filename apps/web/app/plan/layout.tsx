import type { ReactNode } from "react";
import { AuthShell } from "../../components/auth-shell";
import { SiteHeader } from "../../components/landing-header";
import { getAuthProviderAvailability } from "../../lib/auth-providers";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { DashboardSignIn } from "../dashboard/dashboard-sign-in";

export default async function PlanLayout({ children }: { children: ReactNode }) {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  const signedIn = authenticated && Boolean(token);
  const providers = getAuthProviderAvailability(process.env);

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
      <main id="main-content" className="planMoment" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
