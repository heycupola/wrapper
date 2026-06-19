import Image from "next/image";
import Link from "next/link";
import { CopyCommand } from "./copy-command";
import { SectionWrapper } from "./section-wrapper";

export function HorizontalLanding() {
  return (
    <div className="horizontalPage">
      <header className="hTopBar">
        <Link href="/" className="logo-container" aria-label="Wrapper home">
          <Image
            src="/wrapper-icon-light.svg"
            alt="wrapper"
            width={36}
            height={36}
            className="logo logo-light"
            priority
          />
          <Image
            src="/wrapper-icon-dark.svg"
            alt="wrapper"
            width={36}
            height={36}
            className="logo logo-dark"
            priority
          />
        </Link>
        <nav className="hNav">
          <a href="#why">Why</a>
          <a href="#flow">How it works</a>
          <a href="#start">Install</a>
          <a href="https://github.com/heycupola/wrapper" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="hScroller" aria-label="Wrapper landing sections">
        <section id="intro" className="hSection hSectionHero">
          <div className="heroCopy">
            <span className="hSectionEyebrow">Your terminal, everywhere</span>
            <h1 className="heroTitle">Wrap any shell. Reach it from any device.</h1>
            <p className="description">
              Wrapper keeps your real shell as the source of truth, then lets you share and attach
              securely over an authenticated relay — only when you choose to.
            </p>
            <CopyCommand
              command="brew install heycupola/tap/wrapper"
              label="Copy install command"
            />
            <div className="hActions">
              <Link className="social-btn social-btn-primary" href="/oauth/authorize">
                Get started
              </Link>
              <a
                className="social-btn"
                href="https://github.com/heycupola/wrapper"
                target="_blank"
                rel="noopener noreferrer"
              >
                Star on GitHub
              </a>
            </div>
          </div>
          <div className="heroMedia">
            <video
              className="heroVideo"
              autoPlay
              muted
              loop
              playsInline
              poster="/wrapper-demo-poster.png"
            >
              <source src="/wrapper-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        <SectionWrapper id="why" eyebrow="Secure by default" title="Share only when you choose">
          <ul className="hList">
            <li>Your host session stays fully local until you explicitly share it</li>
            <li>Relay access uses short-lived, single-use, hashed tickets</li>
            <li>Every attach is authorized against backend owner / shared state</li>
            <li>Disconnect the host and every viewer is dropped immediately</li>
          </ul>
        </SectionWrapper>

        <SectionWrapper id="flow" eyebrow="How it works" title="Four steps to a shared shell">
          <ol className="hList hOrdered">
            <li>
              Sign in from the CLI: <code>wrapper auth login</code>
            </li>
            <li>Finish the quick onboarding checklist in the web app</li>
            <li>
              Run <code>wrapper shell-host</code> and share with <code>Ctrl+\</code> then{" "}
              <code>s</code>
            </li>
            <li>
              Attach from anywhere: <code>wrapper attach --relay --id &lt;id&gt;</code>
            </li>
          </ol>
        </SectionWrapper>

        <section id="start" className="hSection">
          <div className="hSectionHeader">
            <span className="hSectionEyebrow">Install</span>
            <h2 className="hSectionTitle">Get Wrapper in one command</h2>
          </div>
          <div className="hSectionBody installPanel">
            <CopyCommand
              command="brew install heycupola/tap/wrapper"
              label="Copy Homebrew command"
            />
            <CopyCommand
              command="curl -fsSL https://wrapper.sh/install | bash"
              label="Copy curl command"
            />
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
                GitHub
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
          </div>
        </section>
      </main>
    </div>
  );
}
