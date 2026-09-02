import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { ExternalLink } from "./external-link";

type SiteHeaderProps = {
  variant?: "marketing" | "internal";
  actionHref?: string;
  actionLabel?: string;
  showAction?: boolean;
};

export async function SiteHeader({
  variant = "internal",
  actionHref = "/",
  actionLabel = "Back to Wrapper",
  showAction = true,
}: SiteHeaderProps) {
  const marketing = variant === "marketing";
  const stars = marketing ? await getGitHubStars() : null;

  return (
    <header className={`siteHeader ${marketing ? "siteHeaderMarketing landingHeader" : ""}`}>
      <Link href="/" className="siteBrand" aria-label="Wrapper home">
        <BrandMark className="siteBrandMark" priority />
        <span>Wrapper</span>
      </Link>

      {marketing || showAction ? (
        <nav className="siteNav" aria-label={marketing ? "Primary navigation" : "Page navigation"}>
          {marketing ? (
            <>
              <Link href="/dashboard" className="siteNavText">
                Dashboard
              </Link>
              <ExternalLink className="siteNavText" href="https://docs.wrapper.sh">
                Docs
              </ExternalLink>
              <a
                className="githubNavAction"
                href="https://github.com/heycupola/wrapper"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Wrapper on GitHub${stars === null ? "" : `, ${stars} stars`} (opens in a new tab)`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.17c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15A10.8 10.8 0 0 1 12 6.15c.96 0 1.92.13 2.82.38 2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.04.76 2.1v3.1c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
                </svg>
                <span>GitHub</span>
                {stars === null ? null : (
                  <span className="githubStarCount">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m12 2.5 2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.1l-5.73 3.01 1.1-6.37-4.63-4.51 6.4-.93L12 2.5Z" />
                    </svg>
                    {formatStarCount(stars)}
                  </span>
                )}
              </a>
              <a className="primaryAction" href="#start">
                Install Wrapper
              </a>
            </>
          ) : (
            <Link href={actionHref} className="textAction">
              {actionLabel}
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}

export function LandingHeader() {
  return <SiteHeader variant="marketing" />;
}

async function getGitHubStars(): Promise<number | null> {
  try {
    const response = await fetch("https://api.github.com/repos/heycupola/wrapper", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatStarCount(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
}
