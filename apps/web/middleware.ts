import { type NextRequest, NextResponse } from "next/server";
import { GEO_COOKIE, regionFromCountry } from "./lib/geo";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Geo cookie is only for the dormant PostHog consent path.
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return response;

  const country =
    request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? "";

  response.cookies.set(GEO_COOKIE, regionFromCountry(country), {
    path: "/",
    sameSite: "lax",
    maxAge: 86_400,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest).*)"],
};
