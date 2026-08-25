import { describe, expect, test } from "bun:test";
import { verifySvixSignature } from "../convex/lib/svix";

const TEST_SECRET = `whsec_${btoa("wrapper-test-webhook-secret")}`;

async function sign(payload: string, timestamp: string, id: string): Promise<string> {
  const secretBytes = Uint8Array.from("wrapper-test-webhook-secret", (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${payload}`),
  );
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(signatureBytes))));
}

describe("verifySvixSignature", () => {
  test("accepts a current v1 signature", async () => {
    const payload = JSON.stringify({ type: "customer.products.updated" });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(payload, timestamp, id);

    await expect(
      verifySvixSignature(
        payload,
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": `v1,${signature}`,
        },
        TEST_SECRET,
      ),
    ).resolves.toBe(true);
  });

  test("rejects a missing header, stale timestamp, and bad signature", async () => {
    const payload = "{}";
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(payload, timestamp, id);

    await expect(
      verifySvixSignature(
        payload,
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": null,
        },
        TEST_SECRET,
      ),
    ).resolves.toBe(false);

    await expect(
      verifySvixSignature(
        payload,
        {
          "svix-id": id,
          "svix-timestamp": String(Math.floor(Date.now() / 1000) - 301),
          "svix-signature": `v1,${signature}`,
        },
        TEST_SECRET,
      ),
    ).resolves.toBe(false);

    await expect(
      verifySvixSignature(
        payload,
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": "v1,not-the-signature",
        },
        TEST_SECRET,
      ),
    ).resolves.toBe(false);
  });
});
