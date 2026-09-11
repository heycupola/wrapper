"use client";

import { useActionState } from "react";
import { confirmReleaseNotes, unsubscribeReleaseNotes } from "../lib/release-notes-actions";
import {
  RELEASE_NOTES_COPY,
  ReleaseNotesReceipt,
  type ReleaseNotesMomentVariant,
} from "./release-notes-receipt";
import { Button } from "./ui/button";

type Action = "confirm" | "unsubscribe";

const COPY: Record<Action, { label: string; busy: string; title: string; description: string }> = {
  confirm: {
    label: "Confirm",
    busy: "Confirming…",
    title: "Confirm this address?",
    description:
      "Mail scanners can open the link first. Press confirm so the list only changes after you do.",
  },
  unsubscribe: {
    label: "Unsubscribe",
    busy: "Removing…",
    title: "Stop release notes?",
    description:
      "This only runs after you press the button, so a preview of the mail cannot drop you from the list.",
  },
};

export function ReleaseNotesAction({ action, token }: { action: Action; token: string }) {
  const copy = COPY[action];
  const [result, formAction, pending] = useActionState<ReleaseNotesMomentVariant | null, FormData>(
    action === "confirm" ? confirmReleaseNotes : unsubscribeReleaseNotes,
    null,
  );
  const heading = result ? RELEASE_NOTES_COPY[result.kind] : copy;

  return (
    <>
      <header className="authPageHeader" aria-live="polite" aria-atomic="true">
        <h1 id="auth-page-title" className="authTitle">
          {heading.title}
        </h1>
        <p className="authDescription">{heading.description}</p>
      </header>
      {result ? (
        <ReleaseNotesReceipt variant={result} />
      ) : (
        <form className="authCard" action={formAction}>
          <input type="hidden" name="token" value={token} />
          <div className="authActions">
            <Button variant="primary" type="submit" loading={pending}>
              {pending ? copy.busy : copy.label}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
