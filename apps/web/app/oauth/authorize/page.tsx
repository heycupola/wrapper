import type { Metadata } from "next";
import { AuthShell } from "../../../components/auth-shell";
import { getAuthProviderAvailability } from "../../../lib/auth-providers";
import { getToken, isAuthenticated } from "../../../lib/auth-server";
import { DeviceAuthorizeClient } from "./authorize-client";

export const metadata: Metadata = {
  title: "Authorize a device",
  robots: { index: false, follow: false },
};

export default async function DeviceAuthorizePage() {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);
  const providers = getAuthProviderAvailability(process.env);

  return (
    <AuthShell
      title="Authorize a device"
      description="Confirm the code, then approve or deny access."
      size="narrow"
      showHeaderAction={false}
      showFooter={false}
    >
      <DeviceAuthorizeClient
        authenticated={authenticated}
        initialToken={token ?? null}
        appleEnabled={providers.apple}
      />
    </AuthShell>
  );
}
