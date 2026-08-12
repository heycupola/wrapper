import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy-policy", "/terms-of-service", "/support"],
      disallow: ["/account", "/onboarding", "/oauth/authorize"],
    },
    sitemap: "https://www.wrapper.sh/sitemap.xml",
  };
}
