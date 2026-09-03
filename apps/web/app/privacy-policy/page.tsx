import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../../components/legal-page";

// LEGAL REVIEW REQUIRED: Qualified counsel must review this AI-assisted policy before launch.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Wrapper collects, processes, and protects account and terminal-session data.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="2026-08-26"
      introduction="Wrapper is a remote terminal sharing service operated by Cupola Labs, LLC. Your terminal stays on your machine until you explicitly share it. This policy explains the metadata Wrapper stores, how terminal traffic moves between peers, which providers help us operate the service, and the controls available to you."
    >
      <LegalSection title="Information we collect">
        <h3>Account information</h3>
        <p>
          When you sign in with Apple, GitHub, or Google, we receive the name, email address,
          profile information, and provider identifier made available by that provider. Wrapper does
          not create or store a password for social-login accounts.
        </p>
        <p>
          Apple may send cryptographically signed account-change notifications when an Apple user
          changes email forwarding, revokes consent, or deletes the Apple Account. Wrapper stores
          hashes of the notification id and Apple subject for up to 90 days to prevent replay. It
          does not store the raw Apple subject in that replay record.
        </p>

        <h3>Session metadata</h3>
        <p>
          Convex stores the session identifier, account owner, shell name, working directory,
          process and port metadata, sharing and relay state, timestamps, and close reason. Share
          codes and relay tickets are stored only as cryptographic hashes. Session metadata may be
          sensitive, even though it is not terminal output.
        </p>

        <h3>Terminal content</h3>
        <p>
          Unshared terminal input and output stay on your device. When a direct WebRTC connection
          succeeds, its data channel is encrypted between peers with DTLS. Viewer input prefers that
          channel, while the host keeps a relay output copy available for fallback and mixed
          viewers. When direct connection is unavailable or disabled, all terminal traffic travels
          through the Wrapper relay over TLS. The relay processes that traffic in memory to route it
          and is technically able to access the plaintext after TLS termination. Wrapper does not
          intentionally persist terminal input or output on the relay.
        </p>

        <h3>Local application data</h3>
        <p>
          The CLI stores an authentication session, local session registry, protected local attach
          tokens, telemetry preference, and diagnostic logs on your device. These files are created
          with user-only filesystem permissions where supported.
        </p>

        <h3>Billing and optional analytics</h3>
        <p>
          Autumn and Stripe process subscription and payment information. Wrapper does not store
          payment-card details. Resend sends transactional account emails such as welcome, plan
          change, and deletion notices. Anonymous CLI telemetry is disabled by default and is sent
          to PostHog only after you run <code>wrapper telemetry enable</code>. Telemetry is designed
          not to include terminal input, output, share codes, relay tickets, or authentication
          tokens.
        </p>
      </LegalSection>

      <LegalSection title="How sharing works">
        <ul>
          <li>You must explicitly share a session before a remote viewer can join.</li>
          <li>Your own authenticated devices may join your sessions without a share code.</li>
          <li>Another user needs the session id and the share code supplied by you.</li>
          <li>Every accepted viewer can read output and send input to the shared shell.</li>
          <li>Unsharing closes the host relay bridge and revokes unused viewer tickets.</li>
          <li>Direct P2P connections disclose each peer&apos;s IP address to the other peer.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul>
          <li>Authenticate accounts and authorize session access.</li>
          <li>Route explicitly shared terminal sessions between authorized peers.</li>
          <li>Maintain session liveness, prevent abuse, and investigate service failures.</li>
          <li>Process subscriptions and provide account support.</li>
          <li>Improve Wrapper using optional anonymous telemetry.</li>
          <li>Comply with applicable legal obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers">
        <ul>
          <li>Convex for backend functions, authentication data, and session metadata.</li>
          <li>Fly.io for the authenticated WebSocket relay.</li>
          <li>Vercel for the Wrapper website.</li>
          <li>Apple, GitHub, and Google for optional social authentication.</li>
          <li>Autumn and Stripe for subscriptions and payment processing.</li>
          <li>Resend for transactional account and billing emails.</li>
          <li>PostHog for optional anonymous CLI telemetry.</li>
          <li>Google and Twilio STUN servers for WebRTC network discovery.</li>
        </ul>
        <p>We do not sell personal information or terminal content for advertising.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Wrapper uses TLS for network transport, DTLS for direct WebRTC data channels, short-lived
          single-use relay tickets, hashed share codes, server-side ownership checks, rate limits,
          session-scoped relay routing, and protected local attach tokens. No security control
          eliminates all risk. Treat share codes as secrets and unshare immediately if a code or
          device may be compromised.
        </p>
        <p>
          Report suspected vulnerabilities privately through the instructions on our{" "}
          <Link href="/support#security">support page</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          Account and session metadata is retained while needed to provide, secure, and operate the
          service. Relay tickets expire quickly and are deleted after use or expiry. The application
          does not intentionally retain relayed terminal payloads. Billing providers retain billing
          records under their own policies and applicable law.
        </p>
        <p>
          You can remove local CLI credentials with <code>wrapper auth logout</code>. Signed-in
          users can permanently delete their account from the{" "}
          <Link href="/dashboard">Dashboard</Link>. Wrapper deletes local account data and queues
          removal of the associated billing customer. Temporary billing-provider failures do not
          keep the local account active; bounded background retries continue and operators can
          investigate exhausted cleanup attempts. To request access, correction, export, or
          assistance with deletion, contact{" "}
          <a href="mailto:support@wrapper.sh">support@wrapper.sh</a>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar storage">
        <p>
          The web application uses essential cookies for authentication and session security. We do
          not use advertising or cross-site marketing cookies. Optional CLI telemetry preference is
          stored locally on your device.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, delete, restrict, or
          export personal information and to object to certain processing. We do not sell personal
          information. Contact <a href="mailto:support@wrapper.sh">support@wrapper.sh</a> to make a
          request. You may also complain to your local data-protection authority.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          Our providers may process information in the United States and other countries. Where
          required, we rely on provider contractual safeguards and applicable transfer mechanisms.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Wrapper is not intended for anyone under 18. Contact us if you believe a minor has
          provided personal information so we can investigate and delete it where required.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update this policy as Wrapper changes. Material changes will be reflected by the
          date above and may be communicated through the service or account email.
        </p>
        <p>
          Privacy questions: <a href="mailto:support@wrapper.sh">support@wrapper.sh</a>. See also
          our <Link href="/terms-of-service">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
