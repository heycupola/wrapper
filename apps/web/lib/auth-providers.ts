export type AuthProvider = "apple" | "github" | "google";

export type AuthProviderAvailability = Readonly<Record<AuthProvider, boolean>>;

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
