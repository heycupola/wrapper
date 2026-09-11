"use client";

import type { SubscribeResponse } from "./release-notes";

type IntakeFailure = { code: "invalid" | "rate_limited" | "unavailable"; message: string };

const NETWORK_FAILURE: IntakeFailure = {
  code: "unavailable",
  message: "Could not reach the server. Try again in a moment.",
};

export async function submitSubscribe(input: {
  email: string;
  source: string;
  honeypot: string;
  elapsedMs: number;
}): Promise<SubscribeResponse> {
  let payload: SubscribeResponse | IntakeFailure | null;
  try {
    const response = await fetch("/api/release-notes/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    payload = (await response.json().catch(() => null)) as SubscribeResponse | IntakeFailure | null;
  } catch {
    payload = null;
  }
  if (!payload) return { status: "error", ...NETWORK_FAILURE };
  if ("status" in payload) return payload;
  return { status: "error", ...payload };
}
