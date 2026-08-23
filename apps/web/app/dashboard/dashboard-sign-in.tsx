"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SocialSignInButtons } from "../../components/social-sign-in";
import { authClient } from "../../lib/auth-client";

export function DashboardSignIn({ appleEnabled }: { appleEnabled: boolean }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: "apple" | "github" | "google"): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: pathname,
      });
      if (result.error) throw result.error;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in could not be started.");
      setPending(false);
    }
  }

  return (
    <section className="dashboardSignIn" aria-labelledby="dashboard-sign-in-title">
      <div>
        <h2 id="dashboard-sign-in-title">Sign in to continue</h2>
        <p>Use the provider linked to your Wrapper profile to open the dashboard.</p>
      </div>
      <SocialSignInButtons
        appleEnabled={appleEnabled}
        disabled={pending}
        onSignIn={(provider) => void signInWith(provider)}
      />
      <p className="authHint">
        Need help opening the dashboard? <Link href="/support">Visit support</Link>.
      </p>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
