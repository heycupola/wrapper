import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

type LastLoginMethodActions = {
  clearLastUsedLoginMethod: () => void;
  getLastUsedLoginMethod: () => string | null;
  isLastUsedLoginMethod: (method: string) => boolean;
};

export const authClient = createAuthClient({
  plugins: [convexClient(), lastLoginMethodClient()],
}) as ReturnType<typeof createAuthClient> & LastLoginMethodActions;
