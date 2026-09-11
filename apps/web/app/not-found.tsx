import type { Metadata } from "next";
import { SiteHeader } from "../components/landing-header";
import { SiteFooter } from "../components/site-footer";
import { Button } from "../components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The requested Wrapper page could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="notFoundShell">
      <SiteHeader actionHref="/support" actionLabel="Support" />

      <main id="main-content" className="notFoundMain" tabIndex={-1}>
        <section className="notFoundCopy" aria-labelledby="not-found-title">
          <h1 id="not-found-title">That route is not connected.</h1>
          <p>
            The page may have moved, or the address may be incomplete. Your terminal sessions are
            unaffected.
          </p>
          <nav className="notFoundActions" aria-label="Page recovery">
            <Button variant="primary" size="lg" href="/">
              Back to Wrapper
            </Button>
            <Button size="lg" href="/support">
              Visit support
            </Button>
          </nav>
        </section>

        <div className="notFoundTerminal" aria-hidden="true">
          <div className="terminalChrome">
            <span className="terminalDots">
              <span />
              <span />
              <span />
            </span>
            <span>wrapper / route</span>
            <span className="terminalSecure">local</span>
          </div>
          <div className="notFoundTerminalBody">
            <p>
              <span className="prompt">$</span> wrapper open requested-page
            </p>
            <p className="terminalMuted">checking route table...</p>
            <p>
              <span className="notFoundTerminalError">404</span> route not found
            </p>
            <p className="terminalMuted">try: wrapper.sh or wrapper.sh/support</p>
            <span className="terminalCursor" />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
