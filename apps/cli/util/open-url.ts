/**
 * Open an http(s) URL in the user's default browser.
 *
 * Returns false when the URL is not http(s) or the platform opener fails,
 * so callers can keep showing the printed link.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function openUrl(url: string): boolean {
  if (!isHttpUrl(url)) return false;

  try {
    if (process.platform === "darwin") {
      Bun.spawn(["open", url], { stdio: ["ignore", "ignore", "ignore"] });
      return true;
    }
    if (process.platform === "linux") {
      Bun.spawn(["xdg-open", url], { stdio: ["ignore", "ignore", "ignore"] });
      return true;
    }
    if (process.platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", "", url], { stdio: ["ignore", "ignore", "ignore"] });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
