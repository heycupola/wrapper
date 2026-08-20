import type { ReactNode } from "react";
import { SiteHeader } from "./landing-header";
import { SiteFooter } from "./site-footer";

interface LegalPageProps {
  title: string;
  lastUpdated?: string;
  introduction: string;
  children: ReactNode;
}

export function LegalPage({ title, lastUpdated, introduction, children }: LegalPageProps) {
  return (
    <div className="legalShell">
      <SiteHeader />
      <main id="main-content" className="legalMain" tabIndex={-1}>
        <div className="legalTitle">
          <h1>{title}</h1>
          {lastUpdated ? <p>Last updated: {lastUpdated}</p> : null}
        </div>
        <section className="legalIntroduction">
          <p>{introduction}</p>
        </section>
        <div className="legalSections">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="legalSectionContent">{children}</div>
    </section>
  );
}
