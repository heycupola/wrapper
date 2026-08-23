import type { Metadata } from "next";
import Link from "next/link";
import { IosViewerCta } from "../../../components/ios-viewer-cta";
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
        description="Host sessions currently reporting as active for your profile."
        actionHref="/oauth/authorize"
        actionLabel="Authorize a device"
      />

      {sessions === null ? (
        <p className="dashboardEmptyState">Session data is temporarily unavailable.</p>
      ) : sessions.length === 0 ? (
        <section className="dashboardEmptyState">
          <strong>No active sessions</strong>
          <p>Install Wrapper and open an interactive shell to create the first host session.</p>
          <Link className="primaryAction" href="/#start">
            Install Wrapper
          </Link>
        </section>
      ) : (
        <div className="dashboardSessionCards">
          {sessions.map((session) => (
            <article key={session.sessionId} className="dashboardSessionCard">
              <header>
                <div>
                  <span className="dashboardPanelLabel">Shell</span>
                  <h2>{session.shell}</h2>
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
                    <time dateTime={new Date(session.lastHeartbeatAt).toISOString()}>
                      {formatDate(session.lastHeartbeatAt)}
                    </time>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      {sessions && sessions.length > 0 ? (
        <aside className="dashboardNotice dashboardViewerNotice">
          <strong>Open in the iOS viewer</strong>
          <p>Your shell stays on the host. The iOS viewer attaches only after you share.</p>
          <IosViewerCta variant="badge" />
        </aside>
      ) : null}

      <aside className="dashboardNotice">
        <strong>Sharing remains host-controlled</strong>
        <p>
          Use <code>Ctrl+\ u</code> in the host shell to stop sharing immediately. Closing the host
          shell closes its session. Read the{" "}
          <a href="https://docs.wrapper.sh" target="_blank" rel="noreferrer">
            session documentation
          </a>{" "}
          for more detail.
        </p>
      </aside>
    </>
  );
}

function formatRelayState(state: "offline" | "connecting" | "online" | "error"): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
