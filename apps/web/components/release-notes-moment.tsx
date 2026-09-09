import { AuthShell } from "./auth-shell";
import {
  RELEASE_NOTES_COPY,
  ReleaseNotesReceipt,
  type ReleaseNotesMomentVariant,
} from "./release-notes-receipt";

export type { ReleaseNotesMomentVariant };

/** Landing page for the confirm and unsubscribe links in release-notes email. */
export function ReleaseNotesMoment({ variant }: { variant: ReleaseNotesMomentVariant }) {
  const copy = RELEASE_NOTES_COPY[variant.kind];

  return (
    <AuthShell title={copy.title} description={copy.description} size="compact">
      <ReleaseNotesReceipt variant={variant} />
    </AuthShell>
  );
}
