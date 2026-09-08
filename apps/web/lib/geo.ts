/** EU, EEA, UK, and Switzerland — analytics cookies wait for consent here. */
export const EU_EEA_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
  "GB",
]);

export const GEO_COOKIE = "wrapper-geo";

/** `eu` or `other`. Used as a first-party cookie set by middleware. */
export type GeoRegion = "eu" | "other";

export function regionFromCountry(country: string | null | undefined): GeoRegion {
  const code = country?.trim().toUpperCase() ?? "";
  if (!code) return "eu";
  return EU_EEA_COUNTRIES.has(code) ? "eu" : "other";
}

/** Missing or `eu` is treated as EU so local/dev and unknown geo require consent. */
export function isEuGeo(value: string | null | undefined): boolean {
  return value !== "other";
}
