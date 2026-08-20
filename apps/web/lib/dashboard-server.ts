import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type DashboardOnboardingState = {
  needsOnboarding: boolean;
  status: "in_progress" | "completed";
  completedProfile: boolean;
  connectedCli: boolean;
  sharedFirstSession: boolean;
  completedAt?: number | null;
};

export type DashboardSession = {
  sessionId: string;
  shell: string;
  cwd: string;
  shared: boolean;
  relayState: "offline" | "connecting" | "online" | "error";
  createdAt: number;
  updatedAt: number;
  lastHeartbeatAt: number;
};

const onboardingStateRef = makeFunctionReference<
  "query",
  Record<string, never>,
  DashboardOnboardingState
>("onboarding:getState");

const activeSessionsRef = makeFunctionReference<"query", Record<string, never>, DashboardSession[]>(
  "session:listActive",
);

export async function getDashboardOnboardingState(
  token: string,
): Promise<DashboardOnboardingState | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    return await client.query(onboardingStateRef, {});
  } catch {
    return null;
  }
}

export async function getDashboardSessions(token: string): Promise<DashboardSession[] | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    const sessions = await client.query(activeSessionsRef, {});
    return sessions.map((session) => ({
      sessionId: session.sessionId,
      shell: session.shell,
      cwd: session.cwd,
      shared: session.shared,
      relayState: session.relayState,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
    }));
  } catch {
    return null;
  }
}
