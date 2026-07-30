const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/heycupola/wrapper/main/apps/cli/scripts/install.sh";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(INSTALL_SCRIPT_URL, {
    cache: "no-store",
    headers: {
      accept: "text/plain",
    },
  });

  if (!response.ok) {
    return new Response("Wrapper installer is temporarily unavailable.\n", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
