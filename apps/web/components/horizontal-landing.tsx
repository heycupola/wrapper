import { FAQ_ITEMS, plainAnswer } from "../lib/faq-content";
import { INSTALL_SCENE_ID } from "../lib/landing-scene";
import { QUESTIONS_SECTION_ID } from "../lib/release-notes";
import { ArtDefs, LoopbackArt, RevokeArt, ShareArt, ShellArt } from "./card-art";
import { ConnectionFlow } from "./connection-flow";
import { FaqAccordion } from "./faq/faq-accordion";
import { HorizontalScroll } from "./horizontal-scroll";
import { InstallCta } from "./install-cta";
import { IosViewerCta } from "./ios-viewer-cta";
import { LandingHeader } from "./landing-header";
import { ProductDemo } from "./product-demo";
import { ReleaseNotesSignup } from "./release-notes-signup";
import { SiteFooter } from "./site-footer";
import { Button } from "./ui/button";
import { TicketArt } from "./ticket-art";

const storySectionIds = [
  INSTALL_SCENE_ID,
  "connection",
  "trust",
  "pricing",
  QUESTIONS_SECTION_ID,
] as const;

const INSTALL_HREF = `#${INSTALL_SCENE_ID}`;

/* Module scoped so the JSON is built once, not per render. */
const FAQ_JSON_LD = {
  __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: plainAnswer(item.answer) },
    })),
  }),
};

export function HorizontalLanding() {
  return (
    <div className="landingPage">
      <ArtDefs />
      <LandingHeader />

      <HorizontalScroll sectionIds={storySectionIds}>
        <section
          id={INSTALL_SCENE_ID}
          className="landingSection landingHero"
          aria-labelledby="intro-title"
        >
          <div className="landingSectionInner landingHeroInner">
            <div className="landingHeroMedia revealItem">
              <ProductDemo />
            </div>

            <div className="landingHeroCopy revealStack">
              <h1 id="intro-title" className="landingHeroTitle revealItem">
                Your terminal,
                <br />
                still running.
                <br />
                Wherever <span className="noWrap">you are.</span>
              </h1>
              <p className="landingLead revealItem">
                Keep your real shell on your machine. Reach it from another device only when you
                explicitly share it.
              </p>
              <div className="landingHeroInstall revealItem">
                <InstallCta />
              </div>
              <div className="landingActions revealItem">
                <IosViewerCta variant="badge" className="landingHeroViewer" />
                <Button variant="link" href="https://docs.wrapper.sh/guides/installation" external>
                  Other ways to install
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="connection"
          className="landingSection landingConnection"
          aria-labelledby="connection-title"
        >
          <div className="landingSectionInner landingSplit">
            <div className="landingSectionCopy revealStack">
              <h2 id="connection-title" className="landingSectionTitle revealItem">
                Direct when possible.
                <br />
                Available when not.
              </h2>
              <p className="landingBody revealItem">
                Interactive traffic takes the shortest secure path. Signaling and fallback remain
                authenticated end to end.
              </p>
              {/* The bullets follow the diagram's story (landing.css, --conn-story). */}
              <ol className="connectionSteps revealItem" data-live>
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
              <Button variant="link" href="/privacy-policy" className="landingTextLink revealItem">
                Read the data-flow details
              </Button>
            </div>

            <div className="landingConnectionVisual revealItem">
              <ConnectionFlow />
            </div>
          </div>
        </section>

        <section id="trust" className="landingSection landingTrust" aria-labelledby="trust-title">
          <div className="landingSectionInner landingTrustInner">
            <div className="landingSectionCopy revealStack">
              <h2 id="trust-title" className="landingSectionTitle revealItem">
                Nothing leaves
                <br />
                until you say so.
              </h2>
              <p className="landingBody revealItem">
                Your process, filesystem, credentials, and history stay on the host. Sharing takes
                two keys and ends with two more.
              </p>
              <Button variant="link" href="/privacy-policy" className="landingTextLink revealItem">
                How terminal data moves
              </Button>
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

        <section
          id="pricing"
          className="landingSection landingPricing"
          aria-labelledby="pricing-title"
        >
          <div className="landingSectionInner landingSplit">
            <div className="landingSectionCopy revealStack">
              <h2 id="pricing-title" className="landingSectionTitle revealItem">
                Local is free.
                <br />
                Remote is Pro.
              </h2>
              <p className="landingBody revealItem">
                Use Wrapper on this machine for free. Upgrade only when a session needs to cross
                networks.
              </p>
              <Button variant="link" href={INSTALL_HREF} className="landingTextLink revealItem">
                Install the free CLI
              </Button>
            </div>

            <div className="landingPriceGrid">
              <article className="landingPriceCard" aria-labelledby="plan-free-title">
                <header>
                  <h3 id="plan-free-title">Free</h3>
                  <p className="landingPrice">
                    <strong>$0</strong>
                    <span>forever</span>
                  </p>
                  <p>Your shell, on this machine.</p>
                </header>
                <ul>
                  <li>Wrap zsh, bash, and fish</li>
                  <li>Attach from the same computer</li>
                  <li>Sessions stay on your machine</li>
                </ul>
                <Button size="lg" block href={INSTALL_HREF}>
                  Install Wrapper
                </Button>
              </article>

              <article
                className="landingPriceCard landingPriceCardPro"
                aria-labelledby="plan-pro-title"
              >
                <header>
                  <h3 id="plan-pro-title">
                    Pro <small>Remote access</small>
                  </h3>
                  <p className="landingPrice">
                    <strong>$20</strong>
                    <span>/ month</span>
                  </p>
                  <p>Your shell, from another device.</p>
                </header>
                <ul>
                  <li>Everything in Free</li>
                  <li>Attach from another device</li>
                  <li>Share a session, revoke anytime</li>
                  <li>
                    <IosViewerCta variant="text" />
                  </li>
                </ul>
                <Button variant="primary" size="lg" block href="/dashboard">
                  Choose Pro
                </Button>
                <p className="landingMicrocopy">Sign in to upgrade from the dashboard.</p>
              </article>
            </div>
          </div>
        </section>

        <section
          id={QUESTIONS_SECTION_ID}
          className="landingSection landingQuestions"
          aria-labelledby="questions-title"
        >
          <div className="landingSectionInner landingQuestionsInner">
            <div className="landingQuestionsMain revealStack">
              <h2 id="questions-title" className="landingSectionTitle revealItem">
                Questions,
                <br />
                answered plainly.
              </h2>
              <FaqAccordion className="revealItem" />
              <Button
                variant="link"
                href="https://docs.wrapper.sh"
                external
                className="landingTextLink revealItem"
              >
                More answers in the docs
              </Button>
            </div>

            <div className="landingQuestionsAside revealItem">
              <ReleaseNotesSignup />
              <SiteFooter compact />
            </div>
          </div>
        </section>
      </HorizontalScroll>

      <div className="landingMobileFooter">
        <SiteFooter />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={FAQ_JSON_LD} />
    </div>
  );
}
