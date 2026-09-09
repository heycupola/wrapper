"use client";

import { useEffect, useId, useRef, useState } from "react";
import { submitSubscribe } from "../lib/intake-client";
import { Button } from "./ui/button";

type Status = "idle" | "sending" | "sent" | "error";

/* Same shape the server accepts; catches typos before a round trip. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * "Hear about it when it ships." Not a waitlist: the product is installable
 * today. One field, one button, and a receipt that reads like the CLI.
 *
 * The submit stays enabled so an empty press explains itself instead of a
 * dead button; errors are tied to the field with `aria-describedby` and
 * `aria-invalid`, and focus moves to the receipt once the request succeeds so
 * screen readers hear the outcome without hunting for it. The honeypot and the
 * render-to-submit timer feed the backend's bot check.
 */
export function ReleaseNotesSignup({ className }: { className?: string }) {
  const id = useId();
  const emailId = `${id}-email`;
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const renderedAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (status === "sent") receiptRef.current?.focus();
  }, [status]);

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
    inputRef.current?.focus();
  }

  async function send(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status === "sending") return;
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      fail("Enter an email address.");
      return;
    }
    if (!EMAIL_SHAPE.test(trimmed)) {
      fail("That does not look like an email address.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const result = await submitSubscribe({
      email: trimmed,
      source: "landing-questions",
      honeypot,
      elapsedMs: Date.now() - renderedAt.current,
    });
    if (result.status === "check_inbox") {
      setStatus("sent");
      return;
    }
    fail(result.message);
  }

  function reset() {
    setStatus("idle");
    setMessage(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const hasError = status === "error" && message !== null;

  return (
    <form
      className={["notifyBlock", className].filter(Boolean).join(" ")}
      onSubmit={(event) => void send(event)}
      aria-busy={status === "sending" || undefined}
      noValidate
    >
      <h3 className="notifyTitle" id={`${id}-title`}>
        Hear about it when it ships.
      </h3>

      {status === "sent" ? (
        <div className="notifyDone">
          <output ref={receiptRef} className="notifyReceipt" tabIndex={-1} aria-live="polite">
            <span className="notifyReceiptLine">
              <span aria-hidden="true">$</span> wrapper notify {email.trim()}
            </span>
            <span className="notifyReceiptLine isOk">✓ confirmation sent · open it to finish</span>
            <span className="notifyReceiptLine isMuted">nothing arrives until you confirm</span>
          </output>
          <Button variant="link" size="sm" type="button" onClick={reset}>
            Wrong address? Try another
          </Button>
        </div>
      ) : (
        <div className="notifyField">
          <div className="notifyRow">
            <label htmlFor={emailId} className="visuallyHidden">
              Email address
            </label>
            <input
              ref={inputRef}
              id={emailId}
              className="notifyEmail"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              placeholder="you@example.com"
              required
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? `${errorId} ${noteId}` : noteId}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setMessage(null);
                }
              }}
              readOnly={status === "sending"}
            />
            <div className="intakeTrap" aria-hidden="true">
              <label htmlFor={`${id}-company`}>Company</label>
              <input
                id={`${id}-company`}
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={status === "sending"}>
              {status === "sending" ? "Sending" : "Notify me"}
            </Button>
          </div>
          <p id={errorId} className="intakeStatus isError" role="alert">
            {hasError ? message : null}
          </p>
          <p id={noteId} className="landingMicrocopy">
            Release notes only, one email per release. Confirm from your inbox first.
          </p>
        </div>
      )}
    </form>
  );
}
