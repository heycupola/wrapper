import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../../components/legal-page";

// TODO(legal): Have qualified counsel review these terms before public launch.
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing access to and use of Wrapper.",
  alternates: { canonical: "/terms-of-service" },
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="July 27, 2026"
      introduction="These Terms form an agreement between you and Cupola Labs, LLC concerning Wrapper, its CLI, website, backend, relay, documentation, and mobile clients (collectively, the Service). By creating an account or using the Service, you agree to these Terms and the Privacy Policy."
    >
      <LegalSection title="Eligibility and accounts">
        <ul>
          <li>You must be at least 18 years old and legally able to accept these Terms.</li>
          <li>You must provide accurate account information.</li>
          <li>You are responsible for activity performed through your account and devices.</li>
          <li>You must promptly report suspected account or share-code compromise.</li>
        </ul>
      </LegalSection>

      <LegalSection title="The Service">
        <p>
          Wrapper lets a host run a local terminal session and, only after an explicit share action,
          allow authenticated viewers to read and control that session. The Service includes device
          authentication, session metadata, relay tickets, WebSocket relay, optional direct WebRTC
          transport, billing, documentation, and related clients.
        </p>
        <p>
          Features may change, be suspended, or be discontinued. Preview and beta functionality may
          be incomplete and is provided for evaluation.
        </p>
      </LegalSection>

      <LegalSection title="Terminal access and authorization">
        <ul>
          <li>Only host sessions you own or are authorized to operate.</li>
          <li>Only join sessions whose owner has invited or authorized you.</li>
          <li>
            Treat session ids, share codes, authentication tokens, and relay tickets as secrets.
          </li>
          <li>
            Every viewer accepted into a shared session can see terminal output and send commands.
          </li>
          <li>
            You are responsible for commands, data changes, credentials, and consequences arising
            from people you authorize.
          </li>
          <li>Unshare a session immediately when access is no longer required.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You may not:</p>
        <ul>
          <li>
            Access or attempt to access a terminal, account, device, or network without permission.
          </li>
          <li>
            Probe, bypass, or defeat access controls, rate limits, tickets, or security mechanisms.
          </li>
          <li>Use Wrapper to distribute malware, steal credentials, or damage systems.</li>
          <li>Interfere with the availability or integrity of the Service or its providers.</li>
          <li>Use the Service in violation of law or another person&apos;s rights.</li>
          <li>Resell access to the hosted Service without written authorization.</li>
        </ul>
        <p>
          Good-faith security research must follow our private disclosure process and must not
          access another person&apos;s data or disrupt the Service.
        </p>
      </LegalSection>

      <LegalSection title="Plans, billing, and cancellation">
        <p>
          Wrapper may provide free and paid plans. Paid subscriptions are billed in advance through
          Autumn and Stripe. Prices and plan limits may change with reasonable notice. You may
          cancel at any time and retain paid access until the end of the current billing period.
          Fees are non-refundable except where required by law or expressly agreed by us.
        </p>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          You retain ownership of your terminal content and other data. You grant us the limited
          rights needed to authenticate you, store session metadata, route explicitly shared
          traffic, prevent abuse, and operate the Service.
        </p>
        <p>
          Unshared terminal traffic stays local. Direct P2P traffic uses WebRTC encryption, while
          the host may keep relay output available for fallback and mixed viewers. Relay traffic is
          encrypted in transit but is processed by the relay after TLS termination. Review the{" "}
          <Link href="/privacy-policy">Privacy Policy</Link> before sharing highly sensitive
          sessions.
        </p>
      </LegalSection>

      <LegalSection title="Open-source software and intellectual property">
        <p>
          Wrapper source code is licensed under the license included in its repository. These Terms
          govern the hosted Service, branding, accounts, and commercial features, not rights already
          granted by an open-source license. Wrapper names, marks, website content, and hosted
          services remain the property of Cupola Labs, LLC or their respective owners.
        </p>
      </LegalSection>

      <LegalSection title="Security and availability">
        <p>
          We design Wrapper to restrict session access and protect credentials, but no networked
          service can guarantee uninterrupted or error-free operation. Network restrictions may
          force relay fallback, peers may disconnect, and third-party providers may experience
          outages. You remain responsible for backups, recovery procedures, and confirming commands
          before running them in important systems.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          You may stop using Wrapper and request account deletion. We may suspend or terminate
          access to protect users, investigate misuse, comply with law, or enforce these Terms.
          Provisions concerning ownership, disclaimers, liability, and disputes survive termination.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          To the maximum extent permitted by law, the Service is provided &quot;as is&quot; and
          &quot;as available&quot; without warranties of merchantability, fitness for a particular
          purpose, non-infringement, uninterrupted availability, or absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Cupola Labs, LLC will not be liable for indirect,
          incidental, special, consequential, exemplary, or punitive damages, or for loss of data,
          credentials, profits, use, or goodwill arising from the Service. Our aggregate liability
          will not exceed the greater of amounts you paid us during the twelve months before the
          claim or one hundred US dollars.
        </p>
      </LegalSection>

      <LegalSection title="Indemnification">
        <p>
          You agree to indemnify and hold Cupola Labs, LLC and its personnel harmless from claims
          arising from your misuse of the Service, unauthorized terminal access you enable, content
          or commands transmitted through your sessions, violation of these Terms, or violation of
          law or third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="Changes, governing law, and disputes">
        <p>
          We may update these Terms and will update the date above for material changes. Continued
          use after the effective date constitutes acceptance. These Terms are governed by Delaware
          law, excluding conflict-of-law principles. Disputes will be resolved through binding
          arbitration in Delaware under the rules of the American Arbitration Association, except
          where applicable law permits another remedy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms: <a href="mailto:support@relic.so">support@relic.so</a>, the
          current Cupola Labs support inbox. Security reports must follow the private process on our{" "}
          <Link href="/support#security">support page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
