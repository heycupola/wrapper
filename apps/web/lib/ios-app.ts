export const IOS_VIEWER_DOCS_URL = "https://docs.wrapper.sh/guides/mobile-viewer";

export type IosAppKind = "store" | "testflight" | "docs";

export type IosAppTarget = {
  href: string;
  label: string;
  kind: IosAppKind;
  external: boolean;
};

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

export function getIosAppTarget(environment: PublicEnvironment = process.env): IosAppTarget {
  const href = sanitizeHttpUrl(environment.NEXT_PUBLIC_IOS_APP_URL);
  const label = environment.NEXT_PUBLIC_IOS_APP_LABEL?.trim() || undefined;

  if (!href) {
    return {
      href: IOS_VIEWER_DOCS_URL,
      label: label ?? "iOS viewer guide",
      kind: "docs",
      external: true,
    };
  }

  const kind = href.includes("testflight.apple.com") ? "testflight" : "store";
  return {
    href,
    label: label ?? (kind === "testflight" ? "Join the iOS beta" : "Get the iOS viewer"),
    kind,
    external: true,
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
