export type AuthProvider = "apple" | "github" | "google";

export type AuthProviderAvailability = Readonly<Record<AuthProvider, boolean>>;

const SIGN_IN_PROVIDER_ORDER: readonly AuthProvider[] = ["github", "google", "apple"];

type PublicAuthEnvironment = Readonly<Record<string, string | undefined>>;

export function getAuthProviderAvailability(
  environment: PublicAuthEnvironment,
): AuthProviderAvailability {
  return {
    apple: environment.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true",
    github: true,
    google: true,
  };
}

export function isAuthProvider(value: string | null | undefined): value is AuthProvider {
  return value === "apple" || value === "github" || value === "google";
}

export function getSignInProviders(
  availability: AuthProviderAvailability,
  lastUsed: string | null = null,
): AuthProvider[] {
  const providers = SIGN_IN_PROVIDER_ORDER.filter((provider) => availability[provider]);
  if (!isAuthProvider(lastUsed) || !providers.includes(lastUsed)) {
    return providers;
  }

  return [lastUsed, ...providers.filter((provider) => provider !== lastUsed)];
}
