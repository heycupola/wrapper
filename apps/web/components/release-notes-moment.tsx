import { QUESTIONS_SECTION_ID } from "../lib/release-notes";
import { AuthShell } from "./auth-shell";
import { Button } from "./ui/button";

export type ReleaseNotesMomentVariant =
  | { kind: "confirmed"; email: string; alreadyConfirmed: boolean }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "unsubscribed" }
  | { kind: "unavailable" };

const COPY: Record<
  ReleaseNotesMomentVariant["kind"],
  { title: string; description: string; receipt: string }
> = {
  confirmed: {
    title: "You're on the list.",
    description:
      "One email per release, nothing in between. Every message carries a one-click unsubscribe link.",
    receipt: "✓ confirmed",
  },
  expired: {
    title: "That link has expired.",
    description:
      "Confirmation links work for 48 hours. Enter the address again on the homepage and a fresh one is on its way.",
    receipt: "✗ token expired",
  },
  invalid: {
    title: "That link does not match anything.",
    description:
      "It may have been used already, or the address was removed. Nothing has changed on our side.",
    receipt: "✗ token unknown",
  },
  unsubscribed: {
    title: "Removed.",
    description: "That address will not receive release notes. Nothing else is stored for it.",
    receipt: "✓ unsubscribed",
  },
  unavailable: {
    title: "We could not reach the list.",
    description:
      "Try the link again in a minute. If it keeps failing, write to support@wrapper.sh.",
    receipt: "✗ backend unreachable",
  },
};

/** Landing page for the confirm and unsubscribe links in release-notes email. */
export function ReleaseNotesMoment({ variant }: { variant: ReleaseNotesMomentVariant }) {
  const copy = COPY[variant.kind];
  const ok = variant.kind === "confirmed" || variant.kind === "unsubscribed";

  return (
    <AuthShell title={copy.title} description={copy.description} size="compact">
      <div className="authCard">
        <output className={`notifyReceipt notifyReceiptStandalone ${ok ? "" : "isFailed"}`}>
          <span className={`notifyReceiptLine ${ok ? "isOk" : "isErr"}`}>{copy.receipt}</span>
          {variant.kind === "confirmed" ? (
            <>
              <span className="notifyReceiptLine">{variant.email}</span>
              {variant.alreadyConfirmed ? (
                <span className="notifyReceiptLine isMuted">already on the list</span>
              ) : null}
            </>
          ) : null}
        </output>
        <div className="authActions">
          {variant.kind === "expired" || variant.kind === "invalid" ? (
            <Button variant="primary" href={`/#${QUESTIONS_SECTION_ID}`}>
              Enter the address again
            </Button>
          ) : (
            <Button variant="primary" href="/">
              Back to Wrapper
            </Button>
          )}
          <Button href={`/#${QUESTIONS_SECTION_ID}`}>Read the FAQ</Button>
        </div>
      </div>
    </AuthShell>
  );
}
