import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
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
      <header className="legalHeader">
        <Link href="/" className="logo-container" aria-label="Wrapper home">
          <Image
            src="/wrapper-icon-light.svg"
            alt="Wrapper"
            width={36}
            height={36}
            className="logo logo-light"
            priority
          />
          <Image
            src="/wrapper-icon-dark.svg"
            alt="Wrapper"
            width={36}
            height={36}
            className="logo logo-dark"
            priority
          />
        </Link>
        <Link href="/">Back to Wrapper</Link>
      </header>
      <main className="legalMain">
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
