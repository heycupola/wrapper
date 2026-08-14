"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";

type OnboardingState = {
  needsOnboarding: boolean;
  status: "in_progress" | "completed";
  completedProfile: boolean;
  connectedCli: boolean;
  sharedFirstSession: boolean;
  source?: string | null;
  sourceOther?: string | null;
  teamSize?: string | null;
  completedAt?: number | null;
};

type CompleteStepArgs = {
  step: "completedProfile" | "connectedCli" | "sharedFirstSession";
  value?: boolean;
};

const completeStepRef = makeFunctionReference<
  "mutation",
  CompleteStepArgs,
  { ok: boolean; status: "in_progress" | "completed" }
>("onboarding:completeStep");

const completeOnboardingRef = makeFunctionReference<
  "mutation",
  {
    source?: string;
    sourceOther?: string;
    teamSize?: string;
  },
  { ok: boolean }
>("onboarding:complete");

const sourceOptions = new Set(["search", "github", "x", "friend", "other"]);

export function OnboardingClient({
  token,
  initialState,
}: {
  token: string;
  initialState: OnboardingState;
}) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [busy, setBusy] = useState(false);
  const initialSource = state.source ?? "";
  const [source, setSource] = useState(
    sourceOptions.has(initialSource) ? initialSource : initialSource ? "other" : "",
  );
  const [sourceOther, setSourceOther] = useState(
    state.sourceOther ?? (sourceOptions.has(initialSource) ? "" : initialSource),
  );
  const [teamSize, setTeamSize] = useState(state.teamSize ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completedCount =
    Number(state.completedProfile) + Number(state.connectedCli) + Number(state.sharedFirstSession);
  const progressPct = Math.round((completedCount / 3) * 100);

  const client = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    instance.setAuth(token);
    return instance;
  }, [token]);

  async function toggleStep(step: CompleteStepArgs["step"], value: boolean): Promise<void> {
    if (!client) {
      setError("Wrapper account services are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const next = await client.mutation(completeStepRef, { step, value });
      setState((prev) => ({
        ...prev,
        [step]: value,
        status: next.status,
        needsOnboarding: next.status !== "completed",
      }));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function complete(): Promise<void> {
    if (!client) {
      setError("Wrapper account services are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await client.mutation(completeOnboardingRef, {
        source: source.trim() || undefined,
        sourceOther: source === "other" ? sourceOther.trim() || undefined : undefined,
        teamSize: teamSize.trim() || undefined,
      });
      setState((prev) => ({
        ...prev,
        status: "completed",
        needsOnboarding: false,
      }));
      setStatus("Onboarding complete. You can now use Wrapper from the CLI.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authCard">
      <div className="onboardingProgress">
        <div>
          <span>Setup progress</span>
          <strong>{completedCount} of 3</strong>
        </div>
        <progress value={completedCount} max={3} aria-label={`${progressPct}% complete`} />
      </div>

      <div className="onboardingSteps">
        <label
          className="onboardingStep"
          htmlFor="onboarding-account"
          aria-label="Confirm your Wrapper account"
        >
          <input
            id="onboarding-account"
            type="checkbox"
            checked={state.completedProfile}
            disabled={busy}
            onChange={(e) => void toggleStep("completedProfile", e.target.checked)}
          />
          <span>
            <strong>Confirm your Wrapper account</strong>
            <small>Use the account you want associated with CLI sessions and billing.</small>
          </span>
        </label>
        <label className="onboardingStep" htmlFor="onboarding-cli" aria-label="Connect the CLI">
          <input
            id="onboarding-cli"
            type="checkbox"
            checked={state.connectedCli}
            disabled={busy}
            onChange={(e) => void toggleStep("connectedCli", e.target.checked)}
          />
          <span>
            <strong>Connect the CLI</strong>
            <small>
              Run <code>wrapper auth login</code> and finish device authorization.
            </small>
          </span>
        </label>
        <label
          className="onboardingStep"
          htmlFor="onboarding-sharing"
          aria-label="Review sharing controls"
        >
          <input
            id="onboarding-sharing"
            type="checkbox"
            checked={state.sharedFirstSession}
            disabled={busy}
            onChange={(e) => void toggleStep("sharedFirstSession", e.target.checked)}
          />
          <span>
            <strong>Review sharing controls</strong>
            <small>
              Use <code>Ctrl+\</code> then <code>s</code> to share, and <code>Ctrl+\</code> then{" "}
              <code>u</code> to revoke.
            </small>
          </span>
        </label>
      </div>

      <fieldset className="onboardingSurvey">
        <legend>Optional context</legend>
        <p className="authHint">This helps us prioritize documentation and product decisions.</p>

        <label className="authLabel" htmlFor="onboarding-source">
          How did you hear about Wrapper?
        </label>
        <select
          id="onboarding-source"
          className="authInput"
          value={source}
          disabled={busy}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Select an option</option>
          <option value="search">Search</option>
          <option value="github">GitHub</option>
          <option value="x">X</option>
          <option value="friend">Friend or colleague</option>
          <option value="other">Other</option>
        </select>

        {source === "other" ? (
          <>
            <label className="authLabel" htmlFor="onboarding-source-other">
              Tell us where
            </label>
            <input
              id="onboarding-source-other"
              className="authInput"
              value={sourceOther}
              disabled={busy}
              onChange={(e) => setSourceOther(e.target.value)}
              placeholder="Optional"
            />
          </>
        ) : null}

        <label className="authLabel" htmlFor="onboarding-team-size">
          Team size
        </label>
        <select
          id="onboarding-team-size"
          className="authInput"
          value={teamSize}
          disabled={busy}
          onChange={(e) => setTeamSize(e.target.value)}
        >
          <option value="">Select an option</option>
          <option value="1">Just me</option>
          <option value="2-5">2 to 5</option>
          <option value="6-20">6 to 20</option>
          <option value="21+">21 or more</option>
        </select>
      </fieldset>

      <div className="authActions">
        <button
          type="button"
          className="social-btn social-btn-primary"
          disabled={busy || completedCount < 3}
          onClick={() => void complete()}
        >
          {busy ? "Saving…" : "Finish setup"}
        </button>
        <Link className="social-btn" href="/">
          Back to Wrapper
        </Link>
      </div>
      {status ? (
        <output className="authSuccess" aria-live="polite">
          {status}
        </output>
      ) : null}
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
