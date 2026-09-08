import type { Metadata } from "next";
import { AuthShell } from "../../../components/auth-shell";
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
  return (
    <AuthShell
      title="Stop release notes?"
      description="This only runs after you press the button, so a preview of the mail cannot drop you from the list."
      size="compact"
    >
      <ReleaseNotesAction action="unsubscribe" token={token} />
    </AuthShell>
  );
}
