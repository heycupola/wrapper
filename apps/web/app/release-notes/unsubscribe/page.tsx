import type { Metadata } from "next";
import { ReleaseNotesAction } from "../../../components/release-notes-action";
import { ReleaseNotesMoment } from "../../../components/release-notes-moment";

const INVALID = { kind: "invalid" as const };

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Stop receiving Wrapper release notes.",
  robots: { index: false, follow: false },
};

export default async function UnsubscribeReleaseNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <ReleaseNotesMoment variant={INVALID} />;
  }
  return <ReleaseNotesAction action="unsubscribe" token={token} />;
}
