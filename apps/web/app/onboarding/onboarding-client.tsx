"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

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

export function OnboardingClient({
  token,
  initialState,
}: {
  token: string;
  initialState: OnboardingState;
}) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(state.source ?? "");
  const [sourceOther, setSourceOther] = useState(state.sourceOther ?? "");
  const [teamSize, setTeamSize] = useState(state.teamSize ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    instance.setAuth(token);
    return instance;
  }, [token]);

  async function toggleStep(step: CompleteStepArgs["step"], value: boolean): Promise<void> {
    if (!client) {
      setError("Missing NEXT_PUBLIC_CONVEX_URL");
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
      setError("Missing NEXT_PUBLIC_CONVEX_URL");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await client.mutation(completeOnboardingRef, {
        source: source.trim() || undefined,
        sourceOther: sourceOther.trim() || undefined,
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
      <p className="authHint">Mark each step once you've done it.</p>
      <label className="onboardingStep">
        <input
          type="checkbox"
          checked={state.completedProfile}
          disabled={busy}
          onChange={(e) => void toggleStep("completedProfile", e.target.checked)}
        />
        <span>Complete profile setup in web auth</span>
      </label>
      <label className="onboardingStep">
        <input
          type="checkbox"
          checked={state.connectedCli}
          disabled={busy}
          onChange={(e) => void toggleStep("connectedCli", e.target.checked)}
        />
        <span>
          Run <code>wrapper auth login</code> from CLI successfully
        </span>
      </label>
      <label className="onboardingStep">
        <input
          type="checkbox"
          checked={state.sharedFirstSession}
          disabled={busy}
          onChange={(e) => void toggleStep("sharedFirstSession", e.target.checked)}
        />
        <span>Share your first session with Ctrl+\\ then s</span>
      </label>

      <label className="authLabel" htmlFor="onboarding-source">
        How did you hear about Wrapper?
      </label>
      <input
        id="onboarding-source"
        className="authInput"
        value={source}
        disabled={busy}
        onChange={(e) => setSource(e.target.value)}
        placeholder="x, github, friend, other"
      />

      <label className="authLabel" htmlFor="onboarding-source-other">
        Optional details
      </label>
      <input
        id="onboarding-source-other"
        className="authInput"
        value={sourceOther}
        disabled={busy}
        onChange={(e) => setSourceOther(e.target.value)}
        placeholder="free text"
      />

      <label className="authLabel" htmlFor="onboarding-team-size">
        Team size
      </label>
      <input
        id="onboarding-team-size"
        className="authInput"
        value={teamSize}
        disabled={busy}
        onChange={(e) => setTeamSize(e.target.value)}
        placeholder="1, 2-5, 6-20"
      />

      <div className="authActions">
        <button
          type="button"
          className="social-btn"
          disabled={busy}
          onClick={() => void complete()}
        >
          Finish onboarding
        </button>
      </div>
      {status ? <p className="authSuccess">{status}</p> : null}
      {error ? <p className="authError">{error}</p> : null}
    </div>
  );
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}
