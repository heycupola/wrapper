import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../components/site-footer";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The requested Wrapper page could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="notFoundShell">
      <header className="legalHeader">
        <Link href="/" className="authBrand" aria-label="Wrapper home">
          <span className="logo-container">
            <Image
              src="/wrapper-icon-light.svg"
              alt=""
              width={36}
              height={36}
              className="logo logo-light"
              priority
            />
            <Image
              src="/wrapper-icon-dark.svg"
              alt=""
              width={36}
              height={36}
              className="logo logo-dark"
              priority
            />
          </span>
          <span>Wrapper</span>
        </Link>
        <Link href="/support">Support</Link>
      </header>

      <main id="main-content" className="notFoundMain" tabIndex={-1}>
        <section className="notFoundCopy" aria-labelledby="not-found-title">
          <span className="hSectionEyebrow">Error 404</span>
          <h1 id="not-found-title">That route is not connected.</h1>
          <p>
            The page may have moved, or the address may be incomplete. Your terminal sessions are
            unaffected.
          </p>
          <nav className="notFoundActions" aria-label="Page recovery">
            <Link className="primaryAction" href="/">
              Back to Wrapper
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="textAction" href="/support">
              Visit support
            </Link>
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
