import Link from "next/link";
import { getIosAppTarget } from "../lib/ios-app";
import { QUESTIONS_SECTION_ID } from "../lib/release-notes";
import { CupolaMark } from "./cupola-mark";
import { ExternalLink } from "./external-link";

function footerGroups() {
  const ios = getIosAppTarget();
  return [
    {
      title: "Product",
      links: [
        {
          href: "https://docs.wrapper.sh",
          label: "Docs",
          external: true,
        },
        { href: ios.href, label: ios.navLabel, external: ios.external },
        { href: `/#${QUESTIONS_SECTION_ID}`, label: "FAQ and release notes" },
        { href: "https://github.com/heycupola/wrapper", label: "GitHub", external: true },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy-policy", label: "Privacy Policy" },
        { href: "/terms-of-service", label: "Terms of Service" },
      ],
    },
    {
      title: "Support",
      links: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/support", label: "Help and Contact" },
        { href: "/support#security", label: "Report a Vulnerability" },
        { href: "https://x.com/heycupola", label: "Cupola on X", external: true },
      ],
    },
  ];
}

function BuiltBy() {
  return (
    <ExternalLink className="builtBy" href="https://cupo.la" aria-label="Built by Cupola">
      <span>Built by</span>
      <CupolaMark />
    </ExternalLink>
  );
}

/**
 * The compact variant is a short column of links under the release-notes
 * form in the last horizontal scene; the full variant closes the stacked
 * page.
 */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    const ios = getIosAppTarget();
    return (
      <footer className="landingFinalFooter">
        <div className="landingFinalFooterMeta">
          <span className="landingFinalFooterCopy">© {new Date().getFullYear()} Wrapper</span>
          <BuiltBy />
        </div>
        <nav aria-label="Footer">
          <ul>
            <li>
              <ExternalLink href="https://docs.wrapper.sh">Docs</ExternalLink>
            </li>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
            <li>
              {ios.external ? (
                <ExternalLink href={ios.href}>{ios.navLabel}</ExternalLink>
              ) : (
                <Link href={ios.href}>{ios.navLabel}</Link>
              )}
            </li>
            <li>
              <ExternalLink href="https://github.com/heycupola/wrapper">GitHub</ExternalLink>
            </li>
            <li>
              <Link href="/privacy-policy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms-of-service">Terms</Link>
            </li>
          </ul>
        </nav>
        <p className="landingFinalFooterNote">Terminal sharing is always opt-in.</p>
      </footer>
    );
  }

  return (
    <footer className="siteFooter">
      <div className="siteFooterGrid">
        {footerGroups().map((group) => (
          <div key={group.title} className="siteFooterGroup">
            <h2>{group.title}</h2>
            <nav aria-label={`${group.title} links`}>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <ExternalLink href={link.href}>{link.label}</ExternalLink>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ))}
      </div>
      <div className="siteFooterMeta">
        <div className="landingFooterMeta">
          <span>© {new Date().getFullYear()} Wrapper</span>
          <BuiltBy />
        </div>
        <p className="siteFooterNote">Terminal sharing is always opt-in.</p>
      </div>
    </footer>
  );
}
