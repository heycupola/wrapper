export function readCookie(cookieHeader: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

export function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  return readCookie(document.cookie, name);
}
