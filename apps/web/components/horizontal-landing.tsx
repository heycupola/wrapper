import Link from "next/link";
import { ArtDefs, LoopbackArt, RevokeArt, ShareArt, ShellArt, TicketArt } from "./card-art";
import { ConnectionFlow } from "./connection-flow";
import { CopyCommand } from "./copy-command";
import { HorizontalScroll } from "./horizontal-scroll";
import { IosViewerCta } from "./ios-viewer-cta";
import { LandingHeader } from "./landing-header";
import { ProductDemo } from "./product-demo";
import { SiteFooter } from "./site-footer";

const storySectionIds = ["intro", "connection", "trust", "pricing", "start"] as const;

export function HorizontalLanding() {
  return (
    <div className="landingPage">
      <ArtDefs />
      <LandingHeader />

      <HorizontalScroll sectionIds={storySectionIds}>
        <section id="intro" className="landingSection landingHero">
          <div className="landingSectionInner landingHeroInner">
            <div className="landingHeroCopy revealStack">
              <h1 className="landingHeroTitle revealItem">
                Your terminal,
                <br />
                still running.
                <br />
                Wherever you are.
              </h1>
              <p className="landingLead revealItem">
                Keep your real shell on your machine. Reach it from another device only when you
                explicitly share it.
              </p>
              <div className="landingActions revealItem">
                <a className="primaryAction landingButtonLarge landingHostDesktop" href="#start">
                  Install Wrapper
                </a>
                <IosViewerCta variant="primary" className="landingViewerMobile" />
                <a className="textAction landingButtonLarge landingHostMobile" href="#start">
                  Install the CLI
                </a>
                <a
                  className="textAction landingButtonLarge"
                  href="https://docs.wrapper.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  See docs
                </a>
              </div>
              <p className="landingMicrocopy landingMicrocopyDesktop revealItem">
                macOS and Linux · zsh, bash, and fish
              </p>
              <p className="landingMicrocopy landingMicrocopyMobile revealItem">
                iOS 18+ · needs a shared host session
              </p>
            </div>

            <div className="landingHeroMedia revealItem">
              <ProductDemo />
            </div>
          </div>
        </section>

        <section id="connection" className="landingSection landingConnection">
          <div className="landingSectionInner landingSplit">
            <div className="landingSectionCopy revealStack">
              <h2 className="landingSectionTitle revealItem">
                Direct when possible.
                <br />
                Available when not.
              </h2>
              <p className="landingBody revealItem">
                Interactive traffic takes the shortest secure path. Signaling and fallback remain
                authenticated end to end.
              </p>
              <ol className="connectionSteps revealItem">
                <li>
                  <span />
                  <div>
                    <strong>Discover</strong>
                    <small>Each ticket is checked before a byte moves.</small>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Connect directly</strong>
                    <small>WebRTC data channel, DTLS encrypted.</small>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Fall back safely</strong>
                    <small>Authenticated WSS through the relay, TLS in transit.</small>
                  </div>
                </li>
              </ol>
              <Link href="/privacy-policy" className="landingTextLink revealItem">
                Read the data-flow details
              </Link>
            </div>

            <div className="landingConnectionVisual revealItem">
              <ConnectionFlow />
            </div>
          </div>
        </section>

        <section id="trust" className="landingSection landingTrust">
          <div className="landingSectionInner landingTrustInner">
            <div className="landingSectionCopy revealStack">
              <h2 className="landingSectionTitle revealItem">
                Nothing leaves
                <br />
                until you say so.
              </h2>
              <p className="landingBody revealItem">
                Your process, filesystem, credentials, and history stay on the host. Sharing takes
                two keys and ends with two more.
              </p>
              <Link href="/privacy-policy" className="landingTextLink revealItem">
                How terminal data moves
              </Link>
            </div>

            <div className="landingTrustGrid">
              <article className="landingFeatureCard">
                <LoopbackArt />
                <div>
                  <h3>Local by default</h3>
                  <p>Loopback only, with a per-session token. No relay or account required.</p>
                </div>
              </article>
              <article className="landingFeatureCard">
                <ShareArt />
                <div>
                  <h3>Two keys to share</h3>
                  <p>
                    <code>Ctrl+\</code> then <code>s</code> opens the tunnel and prints a code.
                  </p>
                </div>
              </article>
              <article className="landingFeatureCard">
                <RevokeArt />
                <div>
                  <h3>Revoke instantly</h3>
                  <p>
                    <code>Ctrl+\</code> then <code>u</code> closes the share and unused tickets.
                  </p>
                </div>
              </article>
              <article className="landingFeatureCard">
                <TicketArt />
                <div>
                  <h3>Single-use tickets</h3>
                  <p>Viewer tickets are random, stored hashed, and expire after 60 seconds.</p>
                </div>
              </article>
              <article className="landingFeatureCard landingFeatureCardWide">
                <ShellArt />
                <div>
                  <h3>Your shell, unchanged</h3>
                  <p>Dotfiles, prompt, plugins, and history behave exactly as before.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="landingSection landingPricing">
          <div className="landingSectionInner landingSplit">
            <div className="landingSectionCopy revealStack">
              <h2 className="landingSectionTitle revealItem">
                Local is free.
                <br />
                Remote is Pro.
              </h2>
              <p className="landingBody revealItem">
                Use Wrapper on this machine for free. Upgrade only when a session needs to cross
                networks.
              </p>
              <a className="landingTextLink revealItem" href="#start">
                Install the free CLI
              </a>
            </div>

            <div className="landingPriceGrid">
              <article className="landingPriceCard">
                <header>
                  <div>
                    <span>Free</span>
                    <p>Your shell, on this machine.</p>
                  </div>
                  <p className="landingPrice">
                    <strong>$0</strong>
                    <span>forever</span>
                  </p>
                </header>
                <ul>
                  <li>Wrapper for zsh, bash, and fish</li>
                  <li>Attach from the same computer</li>
                  <li>Share and revoke controls</li>
                  <li>Per-session secure tokens</li>
                  <li>No account required</li>
                </ul>
                <a className="landingPriceCta" href="#start">
                  Install Wrapper
                </a>
              </article>

              <article className="landingPriceCard landingPriceCardPro">
                <header>
                  <div>
                    <span>
                      Pro <small>Remote access</small>
                    </span>
                    <p>Your shell, from another device.</p>
                  </div>
                  <p className="landingPrice">
                    <strong>$20</strong>
                    <span>/ month</span>
                  </p>
                </header>
                <ul>
                  <li>Everything included in Free</li>
                  <li>Attach from another device</li>
                  <li>Direct WebRTC when available</li>
                  <li>Authenticated relay fallback</li>
                  <li>
                    <IosViewerCta variant="text" />
                  </li>
                </ul>
                <Link className="landingPriceCta landingPriceCtaPrimary" href="/dashboard">
                  Choose Pro
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="start" className="landingSection landingStart">
          <div className="landingSectionInner landingStartInner">
            <div className="landingSectionCopy revealStack">
              <h2 className="landingSectionTitle revealItem">
                Your shell is already
                <br />
                the right shell.
              </h2>
              <p className="landingBody revealItem">
                Install once. Remote access remains off until you explicitly share.
              </p>
              <ol className="landingStepList revealItem">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Install</strong>
                    <small>macOS or Linux. zsh, bash, or fish.</small>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Open a terminal</strong>
                    <small>Every interactive shell is wrapped invisibly.</small>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Share when you choose</strong>
                    <small>
                      <code>Ctrl+\ s</code> to open, <code>Ctrl+\ u</code> to close.
                    </small>
                  </div>
                </li>
              </ol>
            </div>

            <div className="landingInstallPanel revealStack">
              <div className="landingInstallMethods">
                <div className="landingInstallMethod revealItem">
                  <p className="landingInstallLabel">Host · Mac or Linux</p>
                  <div className="landingCommands">
                    <CopyCommand
                      command="brew install heycupola/tap/wrapper"
                      label="Copy Homebrew command"
                    />
                    <CopyCommand
                      command="curl -fsSL https://wrapper.sh/install | bash"
                      label="Copy curl command"
                    />
                  </div>
                </div>
                <div className="landingInstallMethod revealItem">
                  <p className="landingInstallLabel">Viewer · iPhone or iPad</p>
                  <IosViewerCta variant="badge" note />
                </div>
              </div>
              <p className="landingInstallNote revealItem">
                Remote access is opt-in and stays disabled until you share.
              </p>
            </div>
          </div>

          <SiteFooter compact />
        </section>
      </HorizontalScroll>

      <div className="landingMobileFooter">
        <SiteFooter />
      </div>
    </div>
  );
}
