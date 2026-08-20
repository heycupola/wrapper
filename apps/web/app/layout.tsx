import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import "./surfaces.css";
import "./landing.css";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_NAME = "Wrapper";
const SITE_DESCRIPTION =
  "Keep your real shell on your machine and reach it from another device only when you explicitly share it.";
const SITE_URL = "https://www.wrapper.sh";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Wrapper. Your terminal, wherever you are.",
    template: `%s / ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["wrapper", "remote terminal", "terminal sharing", "developer tools", "CLI", "shell"],
  authors: [{ name: "Cupola", url: "https://cupo.la" }],
  creator: "Cupola",
  referrer: "origin-when-cross-origin",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Wrapper. Your terminal, wherever you are.",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_DESCRIPTION }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wrapper. Your terminal, wherever you are.",
    description: SITE_DESCRIPTION,
    creator: "@heycupola",
    site: "@heycupola",
    images: ["/opengraph-image"],
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
    { media: "(prefers-color-scheme: light)", color: "#f6f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistMono.variable}>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body suppressHydrationWarning>
        <a className="skipLink" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
