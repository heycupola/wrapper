import { describe, expect, test } from "bun:test";
import { revokeAppleCredential } from "../convex/lib/appleRevocation";

const unavailableFetcher = async () => new Response(null, { status: 503 });

describe("Apple credential revocation", () => {
  test("prefers the refresh token and sends Apple's required form fields", async () => {
    const requests: Array<{ body: URLSearchParams; url: string }> = [];
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        body: new URLSearchParams(String(init?.body)),
        url: String(input),
      });
      return new Response(null, { status: 200 });
    };

    const result = await revokeAppleCredential({
      accessToken: "access-token",
      clientId: "sh.wrapper.web",
      clientSecret: "client-secret",
      fetcher,
      refreshToken: "refresh-token",
    });

    expect(result).toEqual({ status: "revoked", tokenType: "refresh_token" });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://appleid.apple.com/auth/revoke");
    expect(requests[0]?.body.get("client_id")).toBe("sh.wrapper.web");
    expect(requests[0]?.body.get("client_secret")).toBe("client-secret");
    expect(requests[0]?.body.get("token")).toBe("refresh-token");
    expect(requests[0]?.body.get("token_type_hint")).toBe("refresh_token");
  });

  test("falls back to the access token", async () => {
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("token")).toBe("access-token");
      expect(body.get("token_type_hint")).toBe("access_token");
      return new Response(null, { status: 200 });
    };

    const result = await revokeAppleCredential({
      accessToken: "access-token",
      clientId: "sh.wrapper.web",
      clientSecret: "client-secret",
      fetcher,
    });

    expect(result).toEqual({ status: "revoked", tokenType: "access_token" });
  });

  test("does not call Apple when no revocable token was stored", async () => {
    let called = false;
    const fetcher = async () => {
      called = true;
      return new Response(null, { status: 200 });
    };

    const result = await revokeAppleCredential({
      clientId: "",
      clientSecret: "",
      fetcher,
    });

    expect(result).toEqual({ status: "missing_token" });
    expect(called).toBe(false);
  });

  test("reports Apple revocation failures without exposing the credential", async () => {
    await expect(
      revokeAppleCredential({
        clientId: "sh.wrapper.web",
        clientSecret: "client-secret",
        fetcher: unavailableFetcher,
        refreshToken: "sensitive-refresh-token",
      }),
    ).rejects.toThrow("Apple account revocation failed with status 503");
  });
});
