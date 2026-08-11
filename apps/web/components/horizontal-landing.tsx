import Image from "next/image";
import Link from "next/link";
import { CopyCommand } from "./copy-command";
import { HorizontalScroll } from "./horizontal-scroll";
import { ProductDemo } from "./product-demo";

const sectionIds = ["intro", "trust", "transport", "start"] as const;

export function HorizontalLanding() {
  return (
    <div className="horizontalPage">
      <header className="hTopBar">
        <Link href="/" className="brand" aria-label="Wrapper home">
          <span className="brandMark">
            <Image
              src="/wrapper-icon-light.svg"
              alt=""
              width={32}
              height={32}
              className="logo logo-light"
              priority
            />
            <Image
              src="/wrapper-icon-dark.svg"
              alt=""
              width={32}
              height={32}
              className="logo logo-dark"
              priority
            />
          </span>
          <span className="brandName">wrapper</span>
        </Link>
        <nav className="hNav">
          <Link href="/account">Account</Link>
          <a href="https://docs.wrapper.sh" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href="https://github.com/heycupola/wrapper" target="_blank" rel="noopener noreferrer">
            GitHub
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <HorizontalScroll sectionIds={sectionIds}>
        <section id="intro" className="hSection hSectionHero">
          <div className="heroCopy">
            <span className="hSectionEyebrow">A live shell, by invitation</span>
            <h1 className="heroTitle">
              Your terminal.
              <br />
              Still running.
              <br />
              <em>Wherever you are.</em>
            </h1>
            <p className="description">
              Keep your shell on your machine. Share it with another device only when you choose.
            </p>
            <div className="hActions">
              <a className="primaryAction" href="#start">
                Install Wrapper
                <span aria-hidden="true">→</span>
              </a>
              <a className="textAction" href="https://docs.wrapper.sh/configuration/security">
                Read the security model
              </a>
            </div>
          </div>
          <div className="heroMedia">
            <ProductDemo />
          </div>
        </section>

        <section id="trust" className="hSection hSectionTrust">
          <div className="trustStatement">
            <span className="hSectionEyebrow">Local is the default state</span>
            <h2 className="displayTitle">
              Nothing leaves
              <br />
              until you say so.
            </h2>
            <p>
              Your process, filesystem, credentials, and terminal stay on the host until you share.
            </p>
            <Link href="/privacy-policy" className="inlineLink">
              How terminal data moves
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="trustGrid">
            <article>
              <h3>Private on loopback</h3>
              <p>Local attach uses 127.0.0.1 and a per-session 256-bit token.</p>
            </article>
            <article>
              <h3>Explicit access</h3>
              <p>Another account needs the session id, share code, and a single-use ticket.</p>
            </article>
            <article>
              <h3>Immediate revoke</h3>
              <p>Press Ctrl+\ then u to close sharing and invalidate unused access.</p>
            </article>
          </div>
        </section>

        <section id="transport" className="hSection hSectionTransport">
          <div className="transportCopy">
            <span className="hSectionEyebrow">Latency without fragility</span>
            <h2 className="displayTitle">
              Direct when possible.
              <br />
              Available when not.
            </h2>
            <p>
              WebRTC carries interactive traffic directly. The authenticated relay handles signaling
              and fallback.
            </p>
          </div>
          <div className="transportDiagram" aria-label="P2P and relay transport paths">
            <div className="networkNode networkViewer">
              <span>viewer</span>
              <strong>iPhone / laptop</strong>
            </div>
            <div className="networkPaths">
              <div className="directPath">
                <span>WebRTC · DTLS</span>
                <i />
                <strong>direct input</strong>
              </div>
              <div className="relayPath">
                <span>authenticated WSS</span>
                <i />
                <strong>relay fallback</strong>
              </div>
            </div>
            <div className="relayNode">
              <span>Fly relay</span>
              <small>signaling + fallback</small>
            </div>
            <div className="networkNode networkHost">
              <span>host</span>
              <strong>your real shell</strong>
            </div>
          </div>
          <p className="transportDisclosure">
            Relay fallback is TLS-encrypted in transit and processed while routed. Remote sharing
            requires Pro.
          </p>
        </section>

        <section id="start" className="hSection hSectionStart">
          <div className="installCopy">
            <span className="hSectionEyebrow">Start local. Share when ready.</span>
            <h2 className="displayTitle">
              Your shell is already
              <br />
              the right shell.
            </h2>
            <p>Install Wrapper. Remote access stays off until you share.</p>
          </div>
          <div className="installPanel">
            <CopyCommand
              command="brew install heycupola/tap/wrapper"
              label="Copy Homebrew command"
            />
            <CopyCommand
              command="curl -fsSL https://wrapper.sh/install | bash"
              label="Copy curl command"
            />
            <p className="installSupport">macOS and Linux</p>
            <div className="installLinks">
              <Link href="/support">Support</Link>
              <Link href="/privacy-policy">Privacy</Link>
              <Link href="/terms-of-service">Terms</Link>
            </div>
          </div>
        </section>
      </HorizontalScroll>
    </div>
  );
}
