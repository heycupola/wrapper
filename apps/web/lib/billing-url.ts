const BILLING_ORIGINS = {
  checkout: "https://checkout.stripe.com",
  portal: "https://billing.stripe.com",
} as const;

type BillingDestination = keyof typeof BILLING_ORIGINS;

function getSafeBillingUrl(value: string, destination: BillingDestination): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== BILLING_ORIGINS[destination]) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getSafeBillingPortalUrl(value: string): string | null {
  return getSafeBillingUrl(value, "portal");
}

export function getSafeCheckoutUrl(value: string): string | null {
  return getSafeBillingUrl(value, "checkout");
}
