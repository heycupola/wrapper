"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useMemo, useState } from "react";
import { ReleaseNotesMoment, type ReleaseNotesMomentVariant } from "./release-notes-moment";
import { AuthShell } from "./auth-shell";
import { Button } from "./ui/button";

type Action = "confirm" | "unsubscribe";

const confirmRef = makeFunctionReference<
  "mutation",
  { token: string },
  | { ok: true; email: string; alreadyConfirmed: boolean }
  | { ok: false; reason: "invalid" | "expired" }
>("releaseNotes:confirm");

const unsubscribeRef = makeFunctionReference<"mutation", { token: string }, { ok: boolean }>(
  "releaseNotes:unsubscribe",
);

const PROMPT: Record<Action, { title: string; description: string; label: string; busy: string }> =
  {
    confirm: {
      title: "Confirm this address?",
      description:
        "Mail scanners can open the link first. Press confirm so the list only changes after you do.",
      label: "Confirm",
      busy: "Confirming…",
    },
    unsubscribe: {
      title: "Stop release notes?",
      description:
        "This only runs after you press the button, so a preview of the mail cannot drop you from the list.",
      label: "Unsubscribe",
      busy: "Removing…",
    },
  };

export function ReleaseNotesAction({ action, token }: { action: Action; token: string }) {
  const copy = PROMPT[action];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReleaseNotesMomentVariant | null>(null);
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url ? new ConvexHttpClient(url) : null;
  }, []);

  async function submit(): Promise<void> {
    if (!client) {
      setResult({ kind: "unavailable" });
      return;
    }
    setBusy(true);
    try {
      if (action === "confirm") {
        const response = await client.mutation(confirmRef, { token });
        if (response.ok) {
          setResult({
            kind: "confirmed",
            email: response.email,
            alreadyConfirmed: response.alreadyConfirmed,
          });
        } else {
          setResult({ kind: response.reason });
        }
      } else {
        const response = await client.mutation(unsubscribeRef, { token });
        setResult(response.ok ? { kind: "unsubscribed" } : { kind: "invalid" });
      }
    } catch {
      setResult({ kind: "unavailable" });
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ReleaseNotesMoment variant={result} />;

  return (
    <AuthShell title={copy.title} description={copy.description} size="compact">
      <div className="authCard">
        <div className="authActions">
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {busy ? copy.busy : copy.label}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
