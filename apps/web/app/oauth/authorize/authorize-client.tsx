"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppleSignInButton } from "../../../components/apple-sign-in-button";
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

const getDeviceCodeInfoRef = makeFunctionReference<
  "mutation",
  GetDeviceCodeInfoArgs,
  GetDeviceCodeInfoResponse
>("deviceAuth:getDeviceCodeInfo");

const approveDeviceCodeRef = makeFunctionReference<
  "mutation",
  ApproveOrDenyArgs,
  { success: boolean }
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
        setError("Wrapper account services are temporarily unavailable.");
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
    if (!client) return;
    if (!userCode) return;
    if (hasAutoChecked) return;
    setHasAutoChecked(true);
    void lookupCode(normalizeUserCode(userCode));
  }, [client, hasAutoChecked, lookupCode, userCode]);

  async function performDecision(action: "approve" | "deny"): Promise<void> {
    if (!client) {
      setError("Wrapper account services are temporarily unavailable.");
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
    try {
      if (action === "approve") {
        await client.mutation(approveDeviceCodeRef, { user_code: normalized });
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
          <div className="authActions">
            {appleEnabled ? <AppleSignInButton onClick={() => void signInWith("apple")} /> : null}
            <button type="button" className="social-btn" onClick={() => void signInWith("github")}>
              Continue with GitHub
            </button>
            <button type="button" className="social-btn" onClick={() => void signInWith("google")}>
              Continue with Google
            </button>
          </div>
        </>
      ) : null}

      <label className="authLabel" htmlFor="device-user-code">
        User code
      </label>
      <input
        id="device-user-code"
        className="authInput"
        value={userCode}
        onChange={(e) => {
          setUserCode(e.target.value);
          setDeviceInfo(null);
          setStatus(null);
          setError(null);
        }}
        placeholder="ABCD-1234"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={32}
      />

      <div className="authActions">
        <button
          type="button"
          className="social-btn"
          onClick={() => void lookupCode()}
          disabled={busy}
        >
          {busy ? "Checking…" : "Check code"}
        </button>
      </div>

      {deviceInfo ? (
        <section className="authInfo" aria-label="Device authorization request">
          <div className="deviceRequestHeader">
            <strong>Device request found</strong>
            <span className="deviceStatus" data-status={deviceInfo.status}>
              {deviceInfo.status}
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
              <dd>{deviceInfo.scope ?? "Wrapper account access"}</dd>
            </div>
          </dl>
          <p className="authHint">
            Approve only if this code matches the Wrapper CLI request you started.
          </p>
        </section>
      ) : null}
      {deviceInfo?.status === "pending" ? (
        <div className="authDecision">
          <p className="authHint">This grants the Wrapper CLI access to your Wrapper account.</p>
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
              onClick={() => void performDecision("deny")}
              disabled={busy || !authenticated}
            >
              Deny
            </button>
          </div>
        </div>
      ) : null}
      {status ? (
        <output className="authSuccess" aria-live="polite">
          {status}
        </output>
      ) : null}
      {status === "Device code approved" ? (
        <Link className="social-btn social-btn-primary" href="/onboarding">
          Continue to onboarding
        </Link>
      ) : null}
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function normalizeUserCode(raw: string): string {
  const normalized = raw.trim().toUpperCase().replaceAll(/\s+/g, "-");
  if (normalized.length < 4 || normalized.length > 32) return "";
  return /^[A-Z0-9-]+$/.test(normalized) ? normalized : "";
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
