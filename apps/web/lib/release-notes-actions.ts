"use server";

import { makeFunctionReference } from "convex/server";
import type { ReleaseNotesMomentVariant } from "../components/release-notes-receipt";
import { convexClient } from "./intake-server";

const confirmRef = makeFunctionReference<
  "mutation",
  { token: string },
  | { ok: true; email: string; alreadyConfirmed: boolean }
  | { ok: false; reason: "invalid" | "expired" }
>("releaseNotes:confirm");

const unsubscribeRef = makeFunctionReference<"mutation", { token: string }, { ok: boolean }>(
  "releaseNotes:unsubscribe",
);

function tokenFrom(formData: FormData): string {
  const token = formData.get("token");
  return typeof token === "string" ? token : "";
}

export async function confirmReleaseNotes(
  _previous: ReleaseNotesMomentVariant | null,
  formData: FormData,
): Promise<ReleaseNotesMomentVariant> {
  const token = tokenFrom(formData);
  if (!/^[0-9a-f]{64}$/.test(token)) return { kind: "invalid" };
  const client = convexClient();
  if (!client) return { kind: "unavailable" };
  try {
    const result = await client.mutation(confirmRef, { token });
    if (result.ok) {
      return {
        kind: "confirmed",
        email: result.email,
        alreadyConfirmed: result.alreadyConfirmed,
      };
    }
    return { kind: result.reason };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function unsubscribeReleaseNotes(
  _previous: ReleaseNotesMomentVariant | null,
  formData: FormData,
): Promise<ReleaseNotesMomentVariant> {
  const token = tokenFrom(formData);
  if (!/^[0-9a-f]{64}$/.test(token)) return { kind: "invalid" };
  const client = convexClient();
  if (!client) return { kind: "unavailable" };
  try {
    const result = await client.mutation(unsubscribeRef, { token });
    return result.ok ? { kind: "unsubscribed" } : { kind: "invalid" };
  } catch {
    return { kind: "unavailable" };
  }
}
