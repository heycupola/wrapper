"use client";

import { useActionState } from "react";
import { confirmReleaseNotes, unsubscribeReleaseNotes } from "../lib/release-notes-actions";
import { ReleaseNotesReceipt, type ReleaseNotesMomentVariant } from "./release-notes-receipt";
import { Button } from "./ui/button";

type Action = "confirm" | "unsubscribe";

const COPY: Record<Action, { label: string; busy: string }> = {
  confirm: { label: "Confirm", busy: "Confirming…" },
  unsubscribe: { label: "Unsubscribe", busy: "Removing…" },
};

export function ReleaseNotesAction({ action, token }: { action: Action; token: string }) {
  const copy = COPY[action];
  const [result, formAction, pending] = useActionState<ReleaseNotesMomentVariant | null, FormData>(
    action === "confirm" ? confirmReleaseNotes : unsubscribeReleaseNotes,
    null,
  );

  if (result) return <ReleaseNotesReceipt variant={result} />;

  return (
    <form className="authCard" action={formAction}>
      <input type="hidden" name="token" value={token} />
      <div className="authActions">
        <Button variant="primary" type="submit" loading={pending}>
          {pending ? copy.busy : copy.label}
        </Button>
      </div>
    </form>
  );
}
