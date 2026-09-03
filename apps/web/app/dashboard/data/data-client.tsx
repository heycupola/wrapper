"use client";

import { useState } from "react";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { authClient } from "../../../lib/auth-client";

const CONFIRM_WORD = "DELETE";

export function DashboardDeletion() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirmation === CONFIRM_WORD;

  function close() {
    if (deleting) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  async function deleteProfile(): Promise<void> {
    if (!matches) {
      setError(`Type ${CONFIRM_WORD} exactly to confirm permanent deletion.`);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const result = await authClient.deleteUser();
      if (result.error) throw result.error;
      if (!result.data?.success) throw new Error("Deletion did not complete.");
      window.location.assign("/");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Deletion could not be completed. Please contact support.",
      );
      setDeleting(false);
    }
  }

  return (
    <section className="dashboardDangerPanel" aria-labelledby="delete-profile-title">
      <div>
        <span className="dashboardPanelLabel">Danger zone</span>
        <h2 id="delete-profile-title">Delete profile and data</h2>
        <p>
          Deletion is permanent. Wrapper removes your profile and owned application data, then asks
          Autumn to remove the associated billing customer. Review or cancel a paid plan first.
        </p>
      </div>

      <button
        type="button"
        className="social-btn social-btn-danger dangerAction"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Delete profile and data
      </button>

      <ConfirmDialog
        open={open}
        danger
        title="Delete your profile and data?"
        description="This removes your profile, sessions and billing customer for good. There is no recovery."
        confirmLabel="Permanently delete"
        busyLabel="Deleting…"
        confirmDisabled={!matches}
        busy={deleting}
        initialFocus="first-field"
        onConfirm={() => void deleteProfile()}
        onCancel={close}
      >
        <div className="dashboardDeleteConfirmation">
          <label className="authLabel" htmlFor="delete-profile-input">
            Type <strong>{CONFIRM_WORD}</strong> to continue
          </label>
          <input
            id="delete-profile-input"
            className="authInput"
            value={confirmation}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={deleting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "delete-profile-error" : undefined}
            onChange={(event) => {
              setConfirmation(event.target.value);
              if (error) setError(null);
            }}
          />
          {deleting ? (
            <output className="authInfo">Deleting your profile and associated Wrapper data…</output>
          ) : null}
          {error ? (
            <p id="delete-profile-error" className="authError" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </section>
  );
}
