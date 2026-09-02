import Link from "next/link";
import { ExternalLink } from "../../components/external-link";

export function DashboardPageHeader({
  title,
  description,
  actionHref,
  actionLabel,
  actionVariant = "secondary",
  actionExternal = false,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  actionVariant?: "primary" | "secondary";
  actionExternal?: boolean;
}) {
  const actionClass = actionVariant === "primary" ? "primaryAction" : "textAction";

  return (
    <header className="dashboardPageHeader">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <div className="dashboardPageActions">
          {actionExternal ? (
            <ExternalLink className={actionClass} href={actionHref}>
              {actionLabel}
            </ExternalLink>
          ) : (
            <Link className={actionClass} href={actionHref}>
              {actionLabel}
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
