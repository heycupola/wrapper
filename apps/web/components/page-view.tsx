"use client";

import { useEffect } from "react";
import { trackWebEvent } from "../lib/posthog";

export function PageView({ page }: { page: string }) {
  useEffect(() => {
    trackWebEvent("web_page_viewed", { page });
  }, [page]);

  return null;
}
