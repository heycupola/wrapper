const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export type AppleRevocationResult =
  | { status: "missing_token" }
  | { status: "revoked"; tokenType: "access_token" | "refresh_token" };

type AppleRevocationOptions = {
  accessToken?: string | null;
  clientId: string;
  clientSecret: string;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  refreshToken?: string | null;
};

export async function revokeAppleCredential({
  accessToken,
  clientId,
  clientSecret,
  fetcher = fetch,
  refreshToken,
}: AppleRevocationOptions): Promise<AppleRevocationResult> {
  const normalizedRefreshToken = nonEmpty(refreshToken);
  const normalizedAccessToken = nonEmpty(accessToken);
  const credential =
    normalizedRefreshToken !== null
      ? { token: normalizedRefreshToken, tokenType: "refresh_token" as const }
      : normalizedAccessToken !== null
        ? { token: normalizedAccessToken, tokenType: "access_token" as const }
        : null;

  if (!credential) return { status: "missing_token" };
  if (!clientId.trim() || !clientSecret.trim()) {
    throw new Error("Apple account revocation is not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token: credential.token,
    token_type_hint: credential.tokenType,
  });
  const response = await fetcher(APPLE_REVOKE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Apple account revocation failed with status ${response.status}`);
  }

  return {
    status: "revoked",
    tokenType: credential.tokenType,
  };
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
