"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import { AppleSignInButton } from "../../components/apple-sign-in-button";
import { authClient } from "../../lib/auth-client";
import { getSafeBillingPortalUrl } from "../../lib/billing-url";

type PendingAction = "billing" | "delete" | "sign-in" | "sign-out" | null;

const billingPortalRef = makeFunctionReference<
  "action",
  { returnUrl?: string },
  { portalUrl: string }
>("billing:createBillingPortal");

export function AccountClient({
  authenticated,
  token,
  appleEnabled,
}: {
  authenticated: boolean;
  token: string | null;
  appleEnabled: boolean;
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const convexClient = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl || !token) return null;
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    return client;
  }, [token]);

  async function signInWith(provider: "apple" | "github" | "google"): Promise<void> {
    setPending("sign-in");
    setError(null);
    setStatus(null);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: "/account",
      });
      if (result.error) throw result.error;
    } catch (caught) {
      setError(normalizeError(caught, "Sign in could not be started. Please try again."));
    } finally {
      setPending(null);
    }
  }

  async function openBillingPortal(): Promise<void> {
    if (!convexClient) {
      setError("Wrapper billing services are temporarily unavailable.");
      return;
    }

    setPending("billing");
    setError(null);
    setStatus(null);
    try {
      const returnUrl = new URL("/account", window.location.origin).toString();
      const result = await convexClient.action(billingPortalRef, { returnUrl });
      const portalUrl = getSafeBillingPortalUrl(result.portalUrl);
      if (!portalUrl) {
        throw new Error("The billing provider returned an unexpected portal address.");
      }
      window.location.assign(portalUrl);
    } catch (caught) {
      setError(
        normalizeError(
          caught,
          "The billing portal could not be opened. Please try again or contact support.",
        ),
      );
    } finally {
      setPending(null);
    }
  }

  async function signOut(): Promise<void> {
    setPending("sign-out");
    setError(null);
    setStatus(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw result.error;
      window.location.assign("/");
    } catch (caught) {
      setError(normalizeError(caught, "Sign out failed. Please try again."));
      setPending(null);
    }
  }

  async function deleteAccount(): Promise<void> {
    if (deleteConfirmation !== "DELETE") {
      setError("Type DELETE exactly to confirm permanent account deletion.");
      return;
    }

    setPending("delete");
    setError(null);
    setStatus("Deleting your account and associated Wrapper data…");
    try {
      const result = await authClient.deleteUser();
      if (result.error) throw result.error;
      if (!result.data?.success) {
        throw new Error("Account deletion did not complete.");
      }
      window.location.assign("/");
    } catch (caught) {
      setStatus(null);
      setError(
        normalizeError(
          caught,
          "Account deletion could not be completed. Sign in again and retry, or contact support.",
        ),
      );
      setPending(null);
    }
  }

  if (!authenticated || !token) {
    return (
      <div className="authCard">
        <p className="authHint">
          Sign in with the provider linked to your Wrapper account to manage your session, billing,
          and account data.
        </p>
        <div className="authActions">
          {appleEnabled ? (
            <AppleSignInButton
              disabled={pending !== null}
              onClick={() => void signInWith("apple")}
            />
          ) : null}
          <button
            type="button"
            className="social-btn"
            disabled={pending !== null}
            onClick={() => void signInWith("github")}
          >
            Continue with GitHub
          </button>
          <button
            type="button"
            className="social-btn"
            disabled={pending !== null}
            onClick={() => void signInWith("google")}
          >
            Continue with Google
          </button>
        </div>
        <p className="authHint">
          Need help accessing an account? <Link href="/support">Visit support</Link>.
        </p>
        {error ? (
          <p className="authError" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const accountName = session?.user.name?.trim() || "Wrapper user";
  const accountEmail = session?.user.email || "Loading account email…";

  return (
    <div className="accountSettings">
      <section className="accountPanel" aria-labelledby="account-profile-title">
        <div className="accountPanelHeader">
          <div>
            <span className="accountPanelLabel">Profile</span>
            <h2 id="account-profile-title">Signed-in account</h2>
          </div>
          <span className="deviceStatus" data-status="approved">
            Active
          </span>
        </div>
        <dl className="accountDetails" aria-busy={sessionPending}>
          <div>
            <dt>Name</dt>
            <dd>{sessionPending ? "Loading…" : accountName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{accountEmail}</dd>
          </div>
        </dl>
      </section>

      <section className="accountPanel" aria-labelledby="account-billing-title">
        <div className="accountPanelHeader">
          <div>
            <span className="accountPanelLabel">Subscription</span>
            <h2 id="account-billing-title">Billing</h2>
          </div>
        </div>
        <p className="accountPanelCopy" id="billing-description">
          Open Stripe&apos;s secure billing portal to view invoices, update payment details, or
          cancel a paid plan. Free accounts may not have a billing portal.
        </p>
        <div className="authActions">
          <button
            type="button"
            className="social-btn social-btn-primary"
            aria-describedby="billing-description"
            disabled={pending !== null}
            onClick={() => void openBillingPortal()}
          >
            {pending === "billing" ? "Opening portal…" : "Manage billing"}
          </button>
          <Link className="social-btn" href="/support">
            Billing help
          </Link>
        </div>
      </section>

      <section className="accountPanel" aria-labelledby="account-session-title">
        <div className="accountPanelHeader">
          <div>
            <span className="accountPanelLabel">Security</span>
            <h2 id="account-session-title">Current web session</h2>
          </div>
        </div>
        <p className="accountPanelCopy">
          Sign out of this browser. To remove CLI credentials on another device, run{" "}
          <code>wrapper auth logout</code> on that device.
        </p>
        <div className="authActions">
          <button
            type="button"
            className="social-btn"
            disabled={pending !== null}
            onClick={() => void signOut()}
          >
            {pending === "sign-out" ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      <section className="accountPanel accountDanger" aria-labelledby="account-delete-title">
        <div className="accountPanelHeader">
          <div>
            <span className="accountPanelLabel">Danger zone</span>
            <h2 id="account-delete-title">Delete account</h2>
          </div>
        </div>
        <p className="accountPanelCopy">
          Deletion is permanent. Wrapper removes your account and owned application data, and asks
          Autumn to remove the associated billing customer. Provider records required for legal or
          accounting purposes may remain. If you have a paid plan, review or cancel it in the
          billing portal first.
        </p>
        {!deleteOpen ? (
          <button
            type="button"
            className="social-btn social-btn-danger"
            aria-expanded="false"
            aria-controls="delete-account-confirmation"
            disabled={pending !== null}
            onClick={() => {
              setDeleteOpen(true);
              setError(null);
            }}
          >
            Delete account
          </button>
        ) : (
          <div className="accountDeleteConfirmation" id="delete-account-confirmation">
            <label className="authLabel" htmlFor="delete-account-input">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-account-input"
              className="authInput"
              value={deleteConfirmation}
              autoComplete="off"
              spellCheck={false}
              disabled={pending !== null}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
            <div className="authActions">
              <button
                type="button"
                className="social-btn social-btn-danger"
                disabled={pending !== null || deleteConfirmation !== "DELETE"}
                onClick={() => void deleteAccount()}
              >
                {pending === "delete" ? "Deleting account…" : "Permanently delete account"}
              </button>
              <button
                type="button"
                className="social-btn"
                disabled={pending !== null}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                  setError(null);
                }}
              >
                Keep account
              </button>
            </div>
          </div>
        )}
      </section>

      {status ? (
        <output className="authInfo" aria-live="polite">
          {status}
        </output>
      ) : null}
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function normalizeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}
