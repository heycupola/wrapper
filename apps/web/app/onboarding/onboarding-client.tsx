"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type OnboardingState = {
  needsOnboarding: boolean;
  status: "in_progress" | "completed";
  completedProfile: boolean;
  connectedCli: boolean;
  sharedFirstSession: boolean;
  source?: string | null;
  sourceOther?: string | null;
  teamSize?: string | null;
};

type RequiredStep = "completedProfile" | "connectedCli" | "sharedFirstSession";
type Screen = "cli" | "sharing" | "context";

const completeStepRef = makeFunctionReference<
  "mutation",
  { step: RequiredStep; value?: boolean },
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
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen(initialState));
  const initialSource = initialState.source ?? "";
  const [source, setSource] = useState(
    sourceOptions.has(initialSource) ? initialSource : initialSource ? "other" : "",
  );
  const [sourceOther, setSourceOther] = useState(
    initialState.sourceOther ?? (sourceOptions.has(initialSource) ? "" : initialSource),
  );
  const [teamSize, setTeamSize] = useState(initialState.teamSize ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const instance = new ConvexHttpClient(convexUrl);
    instance.setAuth(token);
    return instance;
  }, [token]);

  async function markComplete(step: RequiredStep): Promise<void> {
    if (!client) throw new Error("Wrapper services are temporarily unavailable.");
    const result = await client.mutation(completeStepRef, { step, value: true });
    setState((previous) => ({
      ...previous,
      [step]: true,
      status: result.status,
      needsOnboarding: result.status !== "completed",
    }));
  }

  async function advance(): Promise<void> {
    if (!client) {
      setError("Wrapper services are temporarily unavailable.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!state.completedProfile) await markComplete("completedProfile");

      if (screen === "cli") {
        if (!state.connectedCli) await markComplete("connectedCli");
        setScreen("sharing");
        return;
      }

      if (screen === "sharing") {
        if (!state.sharedFirstSession) await markComplete("sharedFirstSession");
        setScreen("context");
        return;
      }

      await client.mutation(completeOnboardingRef, {
        source: source.trim() || undefined,
        sourceOther: source === "other" ? sourceOther.trim() || undefined : undefined,
        teamSize: teamSize.trim() || undefined,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Your answer could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboardingSimple">
      {screen === "cli" ? (
        <section className="onboardingQuestion" aria-labelledby="onboarding-cli-title">
          <h2 id="onboarding-cli-title">Have you connected the Wrapper CLI?</h2>
          <p>Run this command in your terminal and finish device authorization.</p>
          <code className="onboardingCommand">wrapper auth login</code>
        </section>
      ) : null}

      {screen === "sharing" ? (
        <section className="onboardingQuestion" aria-labelledby="onboarding-sharing-title">
          <h2 id="onboarding-sharing-title">Do you know how to stop sharing?</h2>
          <p>
            Use <code>Ctrl+\ s</code> to share and <code>Ctrl+\ u</code> to revoke access from the
            host shell.
          </p>
        </section>
      ) : null}

      {screen === "context" ? (
        <section className="onboardingQuestion" aria-labelledby="onboarding-context-title">
          <h2 id="onboarding-context-title">A couple of optional questions</h2>
          <p>You can leave either answer blank.</p>

          <div className="onboardingFields">
            <label className="authLabel" htmlFor="onboarding-source">
              How did you hear about Wrapper?
            </label>
            <select
              id="onboarding-source"
              className="authInput"
              value={source}
              disabled={busy}
              onChange={(event) => setSource(event.target.value)}
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
                  onChange={(event) => setSourceOther(event.target.value)}
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
              onChange={(event) => setTeamSize(event.target.value)}
            >
              <option value="">Select an option</option>
              <option value="1">Just me</option>
              <option value="2-5">2 to 5</option>
              <option value="6-20">6 to 20</option>
              <option value="21+">21 or more</option>
            </select>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="primaryAction onboardingNext"
        disabled={busy}
        onClick={() => void advance()}
      >
        {busy ? "Saving…" : screen === "context" ? "Continue" : "Next"}
      </button>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getInitialScreen(state: OnboardingState): Screen {
  if (!state.connectedCli) return "cli";
  if (!state.sharedFirstSession) return "sharing";
  return "context";
}
