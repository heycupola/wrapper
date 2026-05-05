"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useSearchParams } from "next/navigation";
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
  "query",
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
};

export function DeviceAuthorizeClient({ authenticated, initialToken }: DeviceAuthorizeClientProps) {
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
        setError("Missing NEXT_PUBLIC_CONVEX_URL");
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
        const info = await client.query(getDeviceCodeInfoRef, { user_code: normalized });
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
      setError("Missing NEXT_PUBLIC_CONVEX_URL");
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
      const info = await client.query(getDeviceCodeInfoRef, { user_code: normalized });
      setDeviceInfo(info);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: "github" | "google"): Promise<void> {
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
        onChange={(e) => setUserCode(e.target.value)}
        placeholder="ABCD-1234"
        autoComplete="off"
      />

      <div className="authActions">
        <button
          type="button"
          className="social-btn"
          onClick={() => void lookupCode()}
          disabled={busy}
        >
          Check code
        </button>
        <button
          type="button"
          className="social-btn"
          onClick={() => void performDecision("approve")}
          disabled={busy || !authenticated}
        >
          Approve
        </button>
        <button
          type="button"
          className="social-btn"
          onClick={() => void performDecision("deny")}
          disabled={busy || !authenticated}
        >
          Deny
        </button>
      </div>

      {deviceInfo ? <pre className="authInfo">{JSON.stringify(deviceInfo, null, 2)}</pre> : null}
      {status ? <p className="authSuccess">{status}</p> : null}
      {error ? <p className="authError">{error}</p> : null}
    </div>
  );
}

function normalizeUserCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
