import { PageView } from "../../components/page-view";
import { Button } from "../../components/ui/button";

export function DashboardPageHeader({
  title,
  description,
  analyticsPage,
  actionHref,
  actionLabel,
  actionVariant = "secondary",
  actionExternal = false,
}: {
  title: string;
  description: string;
  analyticsPage: string;
  actionHref?: string;
  actionLabel?: string;
  actionVariant?: "primary" | "secondary";
  actionExternal?: boolean;
}) {
  return (
    <header className="dashboardPageHeader">
      <PageView page={analyticsPage} />
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <div className="dashboardPageActions">
          <Button variant={actionVariant} href={actionHref} external={actionExternal}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </header>
  );
}
