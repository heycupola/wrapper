import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="authShell">
      <header className="legalHeader">
        <Link href="/" className="authBrand" aria-label="Wrapper home">
          <span className="logo-container">
            <Image
              src="/wrapper-icon-light.svg"
              alt=""
              width={36}
              height={36}
              className="logo logo-light"
              priority
            />
            <Image
              src="/wrapper-icon-dark.svg"
              alt=""
              width={36}
              height={36}
              className="logo logo-dark"
              priority
            />
          </span>
          <span>Wrapper</span>
        </Link>
        <Link href="/">Back to Wrapper</Link>
      </header>
      <main id="main-content" className="authMain" tabIndex={-1}>
        <section className="content" aria-labelledby="auth-page-title">
          <span className="hSectionEyebrow">Secure account access</span>
          <h1 id="auth-page-title" className="authTitle">
            {title}
          </h1>
          <p className="description">{description}</p>
          {children}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
