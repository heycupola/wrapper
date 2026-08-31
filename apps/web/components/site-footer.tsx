import Link from "next/link";
import { getIosAppTarget } from "../lib/ios-app";
import { CupolaMark } from "./cupola-mark";

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
        { href: "https://x.com/heycupola", label: "X", external: true },
      ],
    },
  ];
}

function IosViewerCompactLink() {
  const ios = getIosAppTarget();
  return (
    <a href={ios.href} target="_blank" rel="noopener noreferrer">
      {ios.navLabel}
    </a>
  );
}

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="landingFinalFooter">
        <div className="landingFooterMeta">
          <span>© {new Date().getFullYear()} Wrapper</span>
          <a
            className="builtBy"
            href="https://cupo.la"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Built by Cupola"
          >
            <span>Built by</span>
            <CupolaMark />
          </a>
        </div>
        <nav aria-label="Footer">
          <Link href="/dashboard">Dashboard</Link>
          <IosViewerCompactLink />
          <a href="https://github.com/heycupola/wrapper" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://x.com/heycupola" target="_blank" rel="noopener noreferrer">
            X
          </a>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/terms-of-service">Terms</Link>
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
              {group.links.map((link) =>
                "external" in link ? (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
        ))}
      </div>
      <div className="siteFooterMeta">
        <div className="landingFooterMeta">
          <span>© {new Date().getFullYear()} Wrapper</span>
          <a
            className="builtBy"
            href="https://cupo.la"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Built by Cupola"
          >
            <span>Built by</span>
            <CupolaMark />
          </a>
        </div>
        <span>Terminal sharing is always opt-in.</span>
      </div>
    </footer>
  );
}
