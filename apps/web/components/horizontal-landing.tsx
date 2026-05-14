import Image from "next/image";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";

export function HorizontalLanding() {
  return (
    <div className="horizontalPage">
      <header className="hTopBar">
        <div className="logo-container">
          <Image
            src="/wrapper-icon-light.svg"
            alt="wrapper"
            width={40}
            height={40}
            className="logo logo-light"
            priority
          />
          <Image
            src="/wrapper-icon-dark.svg"
            alt="wrapper"
            width={40}
            height={40}
            className="logo logo-dark"
            priority
          />
        </div>
        <nav className="hNav">
          <a href="#why">Why</a>
          <a href="#flow">Flow</a>
          <a href="#start">Start</a>
        </nav>
      </header>

      <main className="hScroller" aria-label="Wrapper landing sections">
        <SectionWrapper
          id="intro"
          eyebrow="Cupola Pattern"
          title="Terminal control that follows you"
        >
          <p className="description">
            Wrapper keeps your real shell as the source of truth, then lets you share and attach
            securely from anywhere. This landing flow intentionally moves horizontally for quick
            narrative scanning.
          </p>
          <div className="hActions">
            <Link className="social-btn" href="/oauth/authorize">
              Authorize Device
            </Link>
            <Link className="social-btn" href="/onboarding">
              Open Onboarding
            </Link>
          </div>
        </SectionWrapper>

        <SectionWrapper id="why" eyebrow="Secure by default" title="Share only when you choose">
          <ul className="hList">
            <li>Host session stays local until you trigger share</li>
            <li>Relay access uses short-lived single-use tickets</li>
            <li>Attach checks owner/shared permissions from backend state</li>
          </ul>
        </SectionWrapper>

        <SectionWrapper id="flow" eyebrow="Workflow" title="Horizontal product flow">
          <ol className="hList hOrdered">
            <li>Login with device auth from CLI</li>
            <li>Complete onboarding checklist in web</li>
            <li>Run shell-host and share via prefix command</li>
            <li>Attach remotely over relay</li>
          </ol>
        </SectionWrapper>

        <SectionWrapper id="start" eyebrow="Get started" title="Links and channels">
          <div className="social-buttons">
            <a
              href="https://x.com/heycupola"
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              Follow on X
            </a>
            <a
              href="https://github.com/heycupola"
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              Follow on GitHub
            </a>
            <a
              href="https://cupo.la"
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              Built by Cupola
            </a>
          </div>
        </SectionWrapper>
      </main>
    </div>
  );
}
