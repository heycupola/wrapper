import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { getAuthProviderAvailability } from "../../lib/auth-providers";
import { getToken, isAuthenticated } from "../../lib/auth-server";
import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "Account settings",
  description: "Manage your Wrapper account, billing, and current web session.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  const providers = getAuthProviderAvailability(process.env);

  return (
    <AuthShell
      title="Account settings"
      description="Manage your signed-in session, open secure billing controls, or permanently delete your account."
    >
      <AccountClient
        authenticated={authenticated}
        token={token ?? null}
        appleEnabled={providers.apple}
      />
    </AuthShell>
  );
}
