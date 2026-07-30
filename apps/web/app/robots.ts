import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy-policy", "/terms-of-service", "/support"],
      disallow: ["/onboarding", "/oauth/authorize"],
    },
    sitemap: "https://wrapper.sh/sitemap.xml",
  };
}
