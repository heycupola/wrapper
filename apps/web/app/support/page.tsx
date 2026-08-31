import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../../components/legal-page";

export const metadata: Metadata = {
  title: "Support",
  description: "Get product help, report bugs, or disclose a Wrapper security issue privately.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      introduction="Start with the documentation and diagnostic commands below. Never include terminal content, share codes, relay tickets, authentication tokens, environment files, or other secrets in a public issue."
    >
      <LegalSection title="Product help">
        <ul>
          <li>
            Read the <a href="https://docs.wrapper.sh">Wrapper documentation</a>.
          </li>
          <li>
            Review the <a href="https://docs.wrapper.sh/troubleshooting">troubleshooting guide</a>.
          </li>
          <li>
            Send a private DM to{" "}
            <a href="https://x.com/heycupola" target="_blank" rel="noopener noreferrer">
              @heycupola on X
            </a>
            . DMs are open.
          </li>
          <li>
            The iOS viewer is in TestFlight beta and attaches to a shared host session. See the{" "}
            <a href="https://docs.wrapper.sh/guides/mobile-viewer">mobile viewer guide</a>.
          </li>
          <li>
            Run <code>wrapper status</code> to inspect local session state.
          </li>
          <li>
            Run <code>wrapper logs --follow</code> and redact all credentials before sharing logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Dashboard, billing, and privacy">
        <p>
          Signed-in users can use the <Link href="/dashboard">Dashboard</Link> to sign out, open
          Stripe&apos;s portal to manage or cancel a paid plan, and permanently delete their Wrapper
          account. Deletion completes only after associated billing-customer cleanup succeeds.
        </p>
        <p>
          If a self-service action is unavailable, or for access, correction, export, and other
          privacy requests, email <a href="mailto:support@wrapper.sh">support@wrapper.sh</a>.
          Include the email address on the account and a description of the issue, but never send
          authentication tokens or terminal content.
        </p>
      </LegalSection>

      <LegalSection title="Bug reports">
        <p>
          Non-sensitive reproducible bugs can be reported through{" "}
          <a href="https://github.com/heycupola/wrapper/issues">GitHub Issues</a>. Include the
          Wrapper version, operating system, whether the active transport was `local`, `relay`, or
          `p2p`, and minimal reproduction steps using test data.
        </p>
      </LegalSection>

      <LegalSection title="Security reporting">
        <div id="security">
          <p>
            Do not open a public issue or pull request for a suspected vulnerability. Email{" "}
            <a href="mailto:can@wrapper.sh">can@wrapper.sh</a> or use the repository&apos;s{" "}
            <a href="https://github.com/heycupola/wrapper/security/advisories/new">
              private GitHub security advisory form
            </a>
            .
          </p>
          <p>
            Include affected versions, impact, reproduction steps, and a safe proof of concept. Do
            not access another user&apos;s terminal, retain terminal data, or disrupt production. We
            will acknowledge valid reports as soon as practical and coordinate disclosure after
            affected users are protected.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Immediate access revocation">
        <ul>
          <li>
            Press <code>Ctrl+\</code> then <code>u</code> in the host to stop sharing.
          </li>
          <li>
            Run <code>wrapper auth logout</code> on a device whose authentication may be exposed.
          </li>
          <li>Close the host shell to terminate the session and disconnect viewers.</li>
          <li>Contact security support if you suspect unauthorized access.</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
