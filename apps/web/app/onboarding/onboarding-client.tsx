"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

type Screen = "cli" | "sharing" | "context";

const SCREEN_COPY: Record<Screen, { title: string; description: ReactNode }> = {
  cli: {
    title: "Connect the CLI",
    description: "Run this in your terminal and finish device authorization.",
  },
  sharing: {
    title: "How to stop sharing",
    description: (
      <>
        Use <code>Ctrl+\ s</code> to share and <code>Ctrl+\ u</code> to revoke access from the host
        shell.
      </>
    ),
  },
  context: {
    title: "A couple of optional questions",
    description: "You can leave either answer blank.",
  },
};

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

  async function advance(): Promise<void> {
    if (screen === "cli") {
      setError(null);
      setScreen("sharing");
      return;
    }

    if (screen === "sharing") {
      setError(null);
      setScreen("context");
      return;
    }

    if (!client) {
      setError("Wrapper services are temporarily unavailable.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
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

  const copy = SCREEN_COPY[screen];

  return (
    <div className="onboardingSimple">
      <header className="authPageHeader">
        <h1 id="auth-page-title" className="authTitle">
          {copy.title}
        </h1>
        <p className="authDescription">{copy.description}</p>
      </header>

      {screen === "cli" ? <code className="onboardingCommand">wrapper auth login</code> : null}

      {screen === "context" ? (
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
