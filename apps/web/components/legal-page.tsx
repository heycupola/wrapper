import { Children, isValidElement, type ReactNode } from "react";
import { SiteHeader } from "./landing-header";
import { SiteFooter } from "./site-footer";

interface LegalPageProps {
  title: string;
  /** ISO date (YYYY-MM-DD) of the last revision. */
  lastUpdated?: string;
  introduction: string;
  children: ReactNode;
}

interface LegalSectionProps {
  title: string;
  /** Anchor for deep links; defaults to a slug of the title. */
  id?: string;
  children: ReactNode;
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const LONG_DATE = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function LegalPage({ title, lastUpdated, introduction, children }: LegalPageProps) {
  // The table of contents is derived from the sections themselves so a heading
  // can never drift from its entry.
  const sections = Children.toArray(children)
    .filter((child): child is React.ReactElement<LegalSectionProps> => isValidElement(child))
    .map((child) => ({
      id: child.props.id ?? slug(child.props.title),
      title: child.props.title,
    }));

  return (
    <div className="legalShell">
      <SiteHeader showAction={false} />
      <main id="main-content" className="legalMain" tabIndex={-1}>
        <div className="legalTitle">
          <h1>{title}</h1>
          {lastUpdated ? (
            <p>
              Last updated:{" "}
              <time dateTime={lastUpdated}>{LONG_DATE.format(new Date(lastUpdated))}</time>
            </p>
          ) : null}
        </div>
        <div className="legalIntroduction">
          <p>{introduction}</p>
        </div>
        {sections.length >= 3 ? (
          <nav className="legalContents" aria-labelledby="legal-contents-title">
            <h2 id="legal-contents-title">On this page</h2>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="legalSections">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, id, children }: LegalSectionProps) {
  const anchor = id ?? slug(title);
  return (
    <section id={anchor} aria-labelledby={`${anchor}-title`}>
      <h2 id={`${anchor}-title`}>{title}</h2>
      <div className="legalSectionContent">{children}</div>
    </section>
  );
}
