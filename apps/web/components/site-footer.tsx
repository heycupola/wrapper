import Link from "next/link";

const groups = [
  {
    title: "Product",
    links: [
      {
        href: "https://github.com/heycupola/wrapper/tree/main/apps/docs",
        label: "Docs",
        external: true,
      },
      { href: "/install", label: "Install" },
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
      { href: "/support", label: "Help and Contact" },
      { href: "/support#security", label: "Report a Vulnerability" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterGrid">
        {groups.map((group) => (
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
        <span>© {new Date().getFullYear()} Wrapper by Cupola Labs, LLC</span>
        <span>Terminal sharing is always opt-in.</span>
      </div>
    </footer>
  );
}
