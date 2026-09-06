import type { Metadata } from "next";
import { makeFunctionReference } from "convex/server";
import {
  ReleaseNotesMoment,
  type ReleaseNotesMomentVariant,
} from "../../../components/release-notes-moment";
import { convexClient } from "../../../lib/intake-server";

export const metadata: Metadata = {
  title: "Confirm release notes",
  description: "Finish signing up for Wrapper release notes.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const confirmRef = makeFunctionReference<
  "mutation",
  { token: string },
  | { ok: true; email: string; alreadyConfirmed: boolean }
  | { ok: false; reason: "invalid" | "expired" }
>("releaseNotes:confirm");

export default async function ConfirmReleaseNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <ReleaseNotesMoment variant={await confirm(token)} />;
}

async function confirm(token: string): Promise<ReleaseNotesMomentVariant> {
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
