"use client";

import { useState } from "react";
import { authClient } from "../../../lib/auth-client";

export function DashboardDeletion() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteProfile(): Promise<void> {
    if (confirmation !== "DELETE") {
      setError("Type DELETE exactly to confirm permanent deletion.");
      return;
    }

    setDeleting(true);
    setError(null);
    setStatus("Deleting your profile and associated Wrapper data…");
    try {
      const result = await authClient.deleteUser();
      if (result.error) throw result.error;
      if (!result.data?.success) throw new Error("Deletion did not complete.");
      window.location.assign("/");
    } catch (caught) {
      setStatus(null);
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

      {!open ? (
        <button
          type="button"
          className="social-btn social-btn-danger dangerAction"
          aria-expanded="false"
          aria-controls="delete-profile-confirmation"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
        >
          Delete profile and data
        </button>
      ) : (
        <div className="dashboardDeleteConfirmation" id="delete-profile-confirmation">
          <label className="authLabel" htmlFor="delete-profile-input">
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            id="delete-profile-input"
            className="authInput"
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            disabled={deleting}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <div className="authActions">
            <button
              type="button"
              className="social-btn social-btn-danger dangerAction"
              disabled={deleting || confirmation !== "DELETE"}
              onClick={() => void deleteProfile()}
            >
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              className="social-btn"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status ? (
        <output className="authInfo" aria-live="polite">
          {status}
        </output>
      ) : null}
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
