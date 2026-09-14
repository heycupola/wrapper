export const WRAPPER_CLI_CLIENT_ID = "wrapper-cli";
export const WRAPPER_MOBILE_IOS_CLIENT_ID = "wrapper-mobile-ios";

export function deviceClientLabel(clientId: string | undefined): string {
  if (!clientId || clientId === WRAPPER_CLI_CLIENT_ID) return "Wrapper CLI";
  if (clientId === WRAPPER_MOBILE_IOS_CLIENT_ID) return "iPhone and iPad viewer";
  return clientId;
}

export function normalizeUserCode(raw: string): string {
  const normalized = raw.trim().toUpperCase().replaceAll(/\s+/g, "-");
  if (normalized.length < 4 || normalized.length > 32) return "";
  return /^[A-Z0-9-]+$/.test(normalized) ? normalized : "";
}
