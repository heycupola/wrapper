"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { SocialSignInButtons } from "../../../components/social-sign-in";
import { authClient } from "../../../lib/auth-client";

type GetDeviceCodeInfoArgs = {
  user_code: string;
};

type GetDeviceCodeInfoResponse = {
  userCode: string;
  clientId?: string;
  scope?: string;
  status: "pending" | "approved" | "denied";
} | null;

type ApproveOrDenyArgs = {
  user_code: string;
};

const getOnboardingStateRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { needsOnboarding: boolean }
>("onboarding:getState");

const getDeviceCodeInfoRef = makeFunctionReference<
  "mutation",
  GetDeviceCodeInfoArgs,
  GetDeviceCodeInfoResponse
>("deviceAuth:getDeviceCodeInfo");

const approveDeviceCodeRef = makeFunctionReference<
  "mutation",
  ApproveOrDenyArgs,
  { success: boolean; needsOnboarding: boolean }
>("deviceAuth:approveDeviceCode");

const denyDeviceCodeRef = makeFunctionReference<
  "mutation",
  ApproveOrDenyArgs,
  { success: boolean }
>("deviceAuth:denyDeviceCode");

type DeviceAuthorizeClientProps = {
  authenticated: boolean;
  initialToken: string | null;
  appleEnabled: boolean;
};

export function DeviceAuthorizeClient({
  authenticated,
  initialToken,
  appleEnabled,
}: DeviceAuthorizeClientProps) {
  const searchParams = useSearchParams();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  const [userCode, setUserCode] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/oauth/authorize");
  const [busy, setBusy] = useState(false);
  const [hasAutoChecked, setHasAutoChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<GetDeviceCodeInfoResponse>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [confirmDeny, setConfirmDeny] = useState(false);

  const client = useMemo(() => {
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    if (initialToken) {
      instance.setAuth(initialToken);
    }
    return instance;
  }, [convexUrl, initialToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCallbackUrl(window.location.href);
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("user_code");
    if (!fromUrl) return;
    const normalized = normalizeUserCode(fromUrl);
    if (!normalized) return;
    setUserCode((prev) => (prev.length > 0 ? prev : normalized));
  }, [searchParams]);

  const lookupCode = useCallback(
    async (explicitCode?: string): Promise<void> => {
      if (!client) {
        setError("Wrapper services are temporarily unavailable.");
        return;
      }
      const normalized = explicitCode ?? normalizeUserCode(userCode);
      if (!normalized) {
        setError("Enter a valid user code");
        return;
      }

      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const info = await client.mutation(getDeviceCodeInfoRef, { user_code: normalized });
        setDeviceInfo(info);
        if (!info) setError("Code not found or expired");
      } catch (err) {
        setError(normalizeError(err));
      } finally {
        setBusy(false);
      }
    },
    [client, userCode],
  );

  useEffect(() => {
    if (!client || !authenticated) return;
    void client
      .query(getOnboardingStateRef, {})
      .then((state) => setNeedsOnboarding(state.needsOnboarding))
      .catch(() => {
        setNeedsOnboarding(true);
      });
  }, [authenticated, client]);

  useEffect(() => {
    if (!client) return;
    if (!userCode) return;
    if (hasAutoChecked) return;
    setHasAutoChecked(true);
    void lookupCode(normalizeUserCode(userCode));
  }, [client, hasAutoChecked, lookupCode, userCode]);

  async function performDecision(action: "approve" | "deny"): Promise<void> {
    if (!client) {
      setError("Wrapper services are temporarily unavailable.");
      return;
    }
    if (!authenticated || !initialToken) {
      setError("You need to sign in before approving or denying a device code");
      return;
    }
    const normalized = normalizeUserCode(userCode);
    if (!normalized) {
      setError("Enter a valid user code");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setConfirmDeny(false);
    try {
      if (action === "approve") {
        const result = await client.mutation(approveDeviceCodeRef, { user_code: normalized });
        setNeedsOnboarding(result.needsOnboarding);
        setStatus("Device code approved");
      } else {
        await client.mutation(denyDeviceCodeRef, { user_code: normalized });
        setStatus("Device code denied");
      }
      const info = await client.mutation(getDeviceCodeInfoRef, { user_code: normalized });
      setDeviceInfo(info);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: "apple" | "github" | "google"): Promise<void> {
    setError(null);
    const result = await authClient.signIn.social({
      provider,
      callbackURL: callbackUrl,
    });
    if (result.error?.message) {
      setError(result.error.message);
    }
  }

  return (
    <div className="authCard">
      {!authenticated ? (
        <>
          <p className="authHint">
            Sign in first to approve or deny this CLI device authorization request.
          </p>
          <SocialSignInButtons
            appleEnabled={appleEnabled}
            onSignIn={(provider) => void signInWith(provider)}
          />
        </>
      ) : null}

      <form
        className="authCodeForm"
        onSubmit={(event) => {
          event.preventDefault();
          void lookupCode();
        }}
      >
        <label className="authLabel" htmlFor="device-user-code">
          User code
        </label>
        <input
          id="device-user-code"
          className="authInput authCodeInput"
          value={userCode}
          onChange={(e) => {
            setUserCode(e.target.value);
            setDeviceInfo(null);
            setStatus(null);
            setError(null);
          }}
          placeholder="ABCD-1234"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={32}
          aria-invalid={error && !deviceInfo ? true : undefined}
          aria-describedby={`device-user-code-hint${error ? " device-auth-error" : ""}`}
        />
        <p id="device-user-code-hint" className="authHint">
          The code printed by <code>wrapper auth login</code>, for example ABCD-1234.
        </p>

        <div className="authActions">
          <button type="submit" className="social-btn" disabled={busy}>
            {busy ? "Checking…" : "Check code"}
          </button>
        </div>
      </form>

      {deviceInfo ? (
        <section className="authInfo" aria-label="Device authorization request">
          <div className="deviceRequestHeader">
            <strong>Device request found</strong>
            <span className="deviceStatus" data-status={deviceInfo.status}>
              {STATUS_LABEL[deviceInfo.status]}
            </span>
          </div>
          <dl className="deviceRequestDetails">
            <div>
              <dt>User code</dt>
              <dd>
                <code>{deviceInfo.userCode}</code>
              </dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{deviceInfo.clientId ?? "Wrapper CLI"}</dd>
            </div>
            <div>
              <dt>Requested access</dt>
              <dd>{deviceInfo.scope ?? "Wrapper access"}</dd>
            </div>
          </dl>
          <p className="authHint">
            Approve only if this code matches the Wrapper CLI request you started.
          </p>
        </section>
      ) : null}
      {deviceInfo?.status === "pending" ? (
        <div className="authDecision">
          <p className="authHint">This grants the Wrapper CLI access to your Wrapper profile.</p>
          <div className="authActions">
            <button
              type="button"
              className="social-btn social-btn-primary"
              onClick={() => void performDecision("approve")}
              disabled={busy || !authenticated}
            >
              Approve device
            </button>
            <button
              type="button"
              className="social-btn social-btn-danger"
              aria-haspopup="dialog"
              onClick={() => setConfirmDeny(true)}
              disabled={busy || !authenticated}
            >
              Deny
            </button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDeny}
        danger
        title="Deny this device?"
        description={`The CLI waiting on code ${deviceInfo?.userCode ?? userCode} will be told the request was refused and will have to start over.`}
        confirmLabel="Deny device"
        onConfirm={() => void performDecision("deny")}
        onCancel={() => setConfirmDeny(false)}
      />
      {busy ? <output className="visuallyHidden">Working…</output> : null}
      {status ? <output className="authSuccess">{status}</output> : null}
      {status === "Device code approved" || deviceInfo?.status === "approved" ? (
        <Link
          className="social-btn social-btn-primary"
          href={needsOnboarding ? "/onboarding" : "/dashboard"}
        >
          {needsOnboarding ? "Continue to onboarding" : "Continue to dashboard"}
        </Link>
      ) : null}
      {error ? (
        <p id="device-auth-error" className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<NonNullable<GetDeviceCodeInfoResponse>["status"], string> = {
  pending: "Awaiting your decision",
  approved: "Approved",
  denied: "Denied",
};

function normalizeUserCode(raw: string): string {
  const normalized = raw.trim().toUpperCase().replaceAll(/\s+/g, "-");
  if (normalized.length < 4 || normalized.length > 32) return "";
  return /^[A-Z0-9-]+$/.test(normalized) ? normalized : "";
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
