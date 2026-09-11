import type { Metadata } from "next";
import { ExternalLink } from "../../../components/external-link";
import { IosViewerCta } from "../../../components/ios-viewer-cta";
import { LocalTime } from "../../../components/local-time";
import { Button } from "../../../components/ui/button";
import { getToken } from "../../../lib/auth-server";
import { getDashboardSessions } from "../../../lib/dashboard-server";
import { DashboardPageHeader } from "../dashboard-page-header";
import { DashboardPathValue } from "./path-value";

export const metadata: Metadata = {
  title: "Sessions",
  description: "Review active Wrapper host sessions and sharing state.",
  robots: { index: false, follow: false },
};

export default async function DashboardSessionsPage() {
  const token = await getToken();
  if (!token) return null;

  const sessions = await getDashboardSessions(token);

  return (
    <>
      <DashboardPageHeader
        title="Sessions"
        description="Shared host sessions currently reporting as active for your profile."
        analyticsPage="sessions"
        actionHref="/oauth/authorize"
        actionLabel="Authorize a device"
      />

      {sessions === null ? (
        <section className="dashboardEmptyState">
          <strong>Session data is temporarily unavailable</strong>
          <p>
            Your host sessions are unaffected. Reload in a moment, or check the status of the
            Wrapper services.
          </p>
          <Button variant="primary" href="/dashboard/sessions">
            Reload sessions
          </Button>
        </section>
      ) : sessions.length === 0 ? (
        <section className="dashboardEmptyState">
          <strong>No active sessions</strong>
          <p>
            No shared sessions yet. Run <code>wrapper share</code> on the host. Local unshared
            sessions stay on the machine and do not appear here.
          </p>
          <Button variant="primary" href="https://docs.wrapper.sh/guides/remote-share" external>
            How to share a session
          </Button>
        </section>
      ) : (
        <ul className="dashboardSessionCards" aria-label="Active host sessions">
          {sessions.map((session) => (
            <li key={session.sessionId}>
              <article
                className="dashboardSessionCard"
                aria-labelledby={`session-${session.sessionId}`}
              >
                <header>
                  <div>
                    <span className="dashboardPanelLabel">Shell</span>
                    <h2 id={`session-${session.sessionId}`}>{session.shell}</h2>
                  </div>
                  <span className="dashboardSessionState" data-live={session.shared || undefined}>
                    {session.shared ? "Shared" : "Local"}
                  </span>
                </header>
                <dl>
                  <div>
                    <dt>Working directory</dt>
                    <dd>
                      <DashboardPathValue value={session.cwd} />
                    </dd>
                  </div>
                  <div>
                    <dt>Relay</dt>
                    <dd>{formatRelayState(session.relayState)}</dd>
                  </div>
                  <div>
                    <dt>Session ID</dt>
                    <dd>
                      <code title={session.sessionId}>{session.sessionId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Last heartbeat</dt>
                    <dd>
                      <LocalTime timestamp={session.lastHeartbeatAt} />
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}

      {sessions && sessions.length > 0 ? (
        <aside
          className="dashboardNotice dashboardViewerNotice"
          aria-labelledby="viewer-notice-title"
        >
          <strong id="viewer-notice-title">Open in the iOS viewer beta</strong>
          <p>Your shell stays on the host. The TestFlight viewer attaches only after you share.</p>
          <IosViewerCta variant="badge" />
        </aside>
      ) : null}

      <aside className="dashboardNotice" aria-labelledby="sharing-notice-title">
        <strong id="sharing-notice-title">Sharing remains host-controlled</strong>
        <p>
          Use <code>Ctrl+\ u</code> in the host shell to stop sharing immediately. Closing the host
          shell closes its session. Read the{" "}
          <ExternalLink href="https://docs.wrapper.sh">session documentation</ExternalLink> for more
          detail.
        </p>
      </aside>
    </>
  );
}

function formatRelayState(state: "offline" | "connecting" | "online" | "error"): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
