"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/sessions", label: "Sessions" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/data", label: "Data & deletion" },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="dashboardSidebar" aria-label="Account">
      <nav>
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/dashboard/profile" && pathname === "/dashboard");
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
