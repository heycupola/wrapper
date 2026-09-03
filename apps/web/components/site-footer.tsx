import Link from "next/link";
import { getIosAppTarget } from "../lib/ios-app";
import { CupolaMark } from "./cupola-mark";
import { ExternalLink } from "./external-link";
import { InstallWrapperLink } from "./install-wrapper-link";

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
        { href: "/#start", label: "Install" },
        { href: ios.href, label: ios.navLabel, external: ios.external },
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

function IosViewerCompactLink() {
  const ios = getIosAppTarget();
  return ios.external ? (
    <ExternalLink href={ios.href}>{ios.navLabel}</ExternalLink>
  ) : (
    <Link href={ios.href}>{ios.navLabel}</Link>
  );
}

function BuiltBy() {
  return (
    <ExternalLink className="builtBy" href="https://cupo.la" aria-label="Built by Cupola">
      <span>Built by</span>
      <CupolaMark />
    </ExternalLink>
  );
}

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="landingFinalFooter">
        <div className="landingFooterMeta">
          <span>© {new Date().getFullYear()} Wrapper</span>
          <BuiltBy />
        </div>
        <nav aria-label="Footer">
          <ul>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
            <li>
              <IosViewerCompactLink />
            </li>
            <li>
              <ExternalLink href="https://github.com/heycupola/wrapper">GitHub</ExternalLink>
            </li>
            <li>
              <ExternalLink
                href="https://x.com/heycupola"
                aria-label="Cupola on X (opens in a new tab)"
              >
                X
              </ExternalLink>
            </li>
            <li>
              <Link href="/privacy-policy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms-of-service">Terms</Link>
            </li>
          </ul>
        </nav>
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
                    ) : link.href === "/#start" ? (
                      <InstallWrapperLink>{link.label}</InstallWrapperLink>
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
