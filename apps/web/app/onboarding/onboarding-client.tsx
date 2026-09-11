"use client";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CopyCommand } from "../../components/copy-command";
import { InstallCommands } from "../../components/install-commands";
import { IosViewerCta } from "../../components/ios-viewer-cta";
import { PageView } from "../../components/page-view";
import { Button } from "../../components/ui/button";
import type { IosAppTarget } from "../../lib/ios-app";
import { trackWebEvent } from "../../lib/posthog";

type Screen = "install" | "auth" | "context";

const SCREEN_COPY: Record<Screen, { title: string; description: ReactNode }> = {
  install: {
    title: "Install Wrapper",
    description: "Install the CLI, sign in, then share a session. No rc hook required.",
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
      trackWebEvent("web_onboarding_step_completed", { step: "install" });
      setScreen("auth");
      return;
    }

    if (screen === "auth") {
      setError(null);
      trackWebEvent("web_onboarding_step_completed", { step: "auth" });
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
      trackWebEvent("web_onboarding_completed", {
        source: source.trim() || null,
        teamSize: teamSize.trim() || null,
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
      <PageView page="onboarding" />
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
            <InstallCommands />
            <CopyCommand command="wrapper share" label="Copy share command" />
          </div>
          <p className="onboardingInstallHint">
            Install with curl or brew, then <code>wrapper auth login</code> and{" "}
            <code>wrapper share</code>. <code>wrapper install</code> is optional if you want every
            new terminal wrapped.
          </p>
          <IosViewerCta variant="text" className="onboardingViewerCta" target={iosViewer} />
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

      <Button
        variant="primary"
        className="onboardingNext"
        loading={busy}
        onClick={() => void advance()}
      >
        {busy ? "Saving…" : screen === "context" ? "Continue" : "Next"}
      </Button>

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
