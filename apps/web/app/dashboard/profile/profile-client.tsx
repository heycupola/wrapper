"use client";

import { useState } from "react";
import { authClient } from "../../../lib/auth-client";

export function DashboardProfile() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw result.error;
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign out failed. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="dashboardPageStack">
      <section className="dashboardPanel" aria-labelledby="profile-details-title">
        <div className="dashboardPanelHeader">
          <div>
            <span className="dashboardPanelLabel">Identity</span>
            <h2 id="profile-details-title">Personal details</h2>
          </div>
          <span className="deviceStatus" data-status={user ? "approved" : "pending"}>
            {isPending ? "Loading" : user ? "Signed in" : "Unavailable"}
          </span>
        </div>
        <dl className="dashboardDetails" aria-busy={isPending}>
          <div>
            <dt>Name</dt>
            <dd>{isPending ? "Loading…" : user?.name?.trim() || "Wrapper user"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{isPending ? "Loading…" : user?.email || "Unavailable"}</dd>
          </div>
          <div>
            <dt>Email status</dt>
            <dd>{isPending ? "Loading…" : user?.emailVerified ? "Verified" : "Not verified"}</dd>
          </div>
        </dl>
      </section>

      <section className="dashboardActionPanel" aria-labelledby="profile-session-title">
        <div>
          <h2 id="profile-session-title">Current browser session</h2>
          <p>
            {isPending ? "Loading session…" : `Signed in${user?.email ? ` as ${user.email}` : ""}.`}
          </p>
        </div>
        <button
          type="button"
          className="social-btn"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {error ? (
          <p className="authError" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <aside className="dashboardNotice">
        <strong>Provider-managed identity</strong>
        <p>
          Name, email, and verification are supplied by the provider used to sign in. Wrapper does
          not store a separate password.
        </p>
      </aside>
    </div>
  );
}
