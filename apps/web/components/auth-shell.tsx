import type { ReactNode } from "react";
import { SiteHeader } from "./landing-header";
import { SiteFooter } from "./site-footer";

export function AuthShell({
  title,
  description,
  children,
  size = "compact",
  showHeaderAction = true,
  showFooter = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  size?: "compact" | "wide";
  showHeaderAction?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className={`authShell authShell-${size}`}>
      <SiteHeader showAction={showHeaderAction} />
      <main id="main-content" className="authMain" tabIndex={-1}>
        <section
          className={`authSurface ${size === "wide" ? "authSurfaceWide" : ""}`}
          aria-labelledby="auth-page-title"
        >
          <header className="authPageHeader">
            <h1 id="auth-page-title" className="authTitle">
              {title}
            </h1>
            <p className="authDescription">{description}</p>
          </header>
          {children}
        </section>
      </main>
      {showFooter ? <SiteFooter /> : null}
    </div>
  );
}
