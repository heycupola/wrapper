"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Optional form controls shown between the description and the actions. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Disables confirm; the cancel button stays live so the user can always leave. */
  confirmDisabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  danger?: boolean;
  /** Selector for the element to focus on open; defaults to the cancel button. */
  initialFocus?: "cancel" | "first-field";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation for actions that cannot be undone. Built on the native
 * <dialog>: modal focus containment and Escape are the platform's, and focus
 * goes back to whatever opened it when it closes. Clicking the backdrop does
 * not dismiss it: a destructive confirmation should be left deliberately.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmDisabled = false,
  busy = false,
  busyLabel,
  danger = false,
  initialFocus = "cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      const target =
        initialFocus === "first-field"
          ? dialog.querySelector<HTMLElement>("input, select, textarea")
          : dialog.querySelector<HTMLElement>("[data-dialog-cancel]");
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      className={`confirmDialog ${danger ? "isDanger" : ""}`}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        // Escape: closing while a request is in flight would hide its outcome.
        if (busy) event.preventDefault();
        else onCancel();
      }}
      onClose={() => {
        if (opener.current instanceof HTMLElement) opener.current.focus();
      }}
    >
      <form
        className="confirmDialogPanel"
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmDisabled && !busy) onConfirm();
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="confirmDialogBody">
          {description}
        </p>
        {children}
        <div className="authActions confirmDialogActions">
          <button
            type="button"
            className="social-btn"
            data-dialog-cancel
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={`social-btn ${danger ? "social-btn-danger dangerAction" : "social-btn-primary"}`}
            disabled={confirmDisabled || busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
