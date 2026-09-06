import type { Metadata } from "next";
import { makeFunctionReference } from "convex/server";
import {
  ReleaseNotesMoment,
  type ReleaseNotesMomentVariant,
} from "../../../components/release-notes-moment";
import { convexClient } from "../../../lib/intake-server";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Stop receiving Wrapper release notes.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const unsubscribeRef = makeFunctionReference<"mutation", { token: string }, { ok: boolean }>(
  "releaseNotes:unsubscribe",
);

export default async function UnsubscribeReleaseNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <ReleaseNotesMoment variant={await unsubscribe(token)} />;
}

async function unsubscribe(token: string): Promise<ReleaseNotesMomentVariant> {
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
