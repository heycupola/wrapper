import Link from "next/link";

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
            <a className={actionClass} href={actionHref} target="_blank" rel="noreferrer">
              {actionLabel}
            </a>
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
