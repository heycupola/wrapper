import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_NAME = "wrapper";
const SITE_DESCRIPTION =
  "An AI harness that connects, manages, and orchestrates capabilities across your devices. One command to bridge your remote terminal, your tools, and everything in between.";
const SITE_URL = "https://wrapper.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s / ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["wrapper", "AI", "remote terminal", "orchestration", "developer tools", "CLI"],
  authors: [{ name: "Cupola", url: "https://cupo.la" }],
  creator: "Cupola",
  referrer: "origin-when-cross-origin",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    creator: "@heycupola",
    site: "@heycupola",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E0E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
