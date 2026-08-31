export const IOS_VIEWER_DOCS_URL = "https://docs.wrapper.sh/guides/mobile-viewer";

export type IosAppKind = "store" | "testflight" | "docs";

export type IosAppTarget = {
  href: string;
  label: string;
  navLabel: string;
  kind: IosAppKind;
  external: boolean;
  beta: boolean;
  note: string;
};

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

const STORE_NOTE = "iOS 18+ · needs a shared host session. The shell stays on the host.";
const BETA_NOTE =
  "Beta · TestFlight · iOS 18+ · needs a shared host session. The shell stays on the host.";

export function getIosAppTarget(environment: PublicEnvironment = process.env): IosAppTarget {
  const href = sanitizeHttpUrl(environment.NEXT_PUBLIC_IOS_APP_URL);
  const label = environment.NEXT_PUBLIC_IOS_APP_LABEL?.trim() || undefined;

  if (!href) {
    return {
      href: IOS_VIEWER_DOCS_URL,
      label: label ?? "Get iOS viewer",
      navLabel: "iOS viewer",
      kind: "docs",
      external: true,
      beta: true,
      note: BETA_NOTE,
    };
  }

  const kind = href.includes("testflight.apple.com") ? "testflight" : "store";
  const beta = kind === "testflight";
  return {
    href,
    label: label ?? "Get iOS viewer",
    navLabel: "iOS viewer",
    kind,
    external: true,
    beta,
    note: beta ? BETA_NOTE : STORE_NOTE,
  };
}

function sanitizeHttpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
