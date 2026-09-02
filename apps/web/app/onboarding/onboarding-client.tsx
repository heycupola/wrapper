"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CopyCommand } from "../../components/copy-command";
import { NewTabNote } from "../../components/external-link";
import type { IosAppTarget } from "../../lib/ios-app";

type Screen = "install" | "auth" | "context";

const SCREEN_COPY: Record<Screen, { title: string; description: ReactNode }> = {
  install: {
    title: "Install Wrapper",
    description: "Install the CLI, then enable the shell hook in a new terminal.",
  },
  auth: {
    title: "Connect the CLI",
    description: "Run this in your terminal and finish device authorization.",
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
  iosViewer,
}: {
  token: string;
  initialState: OnboardingState;
  iosViewer: IosAppTarget;
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
    if (screen === "install") {
      setError(null);
      setScreen("auth");
      return;
    }

    if (screen === "auth") {
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
      {/* Each step swaps the heading; the live region reads the new step out so
          the change is not only visual. */}
      <header className="authPageHeader" aria-live="polite" aria-atomic="true">
        <p className="visuallyHidden">
          Step {STEP_ORDER.indexOf(screen) + 1} of {STEP_ORDER.length}
        </p>
        <h1 id="auth-page-title" className="authTitle">
          {copy.title}
        </h1>
        <p className="authDescription">{copy.description}</p>
      </header>

      {screen === "install" ? (
        <div className="onboardingInstall">
          <div className="onboardingCommands">
            <CopyCommand
              command="brew install heycupola/tap/wrapper"
              label="Copy Homebrew install command"
            />
            <CopyCommand
              command="curl -fsSL https://wrapper.sh/install | bash"
              label="Copy curl install command"
            />
            <CopyCommand command="wrapper install" label="Copy shell hook command" />
          </div>
          <p className="onboardingInstallHint">
            Use Homebrew or the script, not both. Then open a new terminal after{" "}
            <code>wrapper install</code> so the hook can wrap your shell.
          </p>
          <a
            className="iosViewerCta iosViewerCtaText onboardingViewerCta"
            href={iosViewer.href}
            target={iosViewer.external ? "_blank" : undefined}
            rel={iosViewer.external ? "noopener noreferrer" : undefined}
          >
            {iosViewer.label}
            {iosViewer.external ? <NewTabNote /> : null}
          </a>
        </div>
      ) : null}

      {screen === "auth" ? (
        <div className="onboardingCommands">
          <CopyCommand command="wrapper auth login" label="Copy sign-in command" />
        </div>
      ) : null}

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
                autoComplete="off"
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

      <output className="visuallyHidden">{busy ? "Saving your answers…" : ""}</output>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STEP_ORDER: Screen[] = ["install", "auth", "context"];

function getInitialScreen(state: OnboardingState): Screen {
  if (!state.connectedCli) return "install";
  return "context";
}
