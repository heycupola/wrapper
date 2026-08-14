/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "../convex/_generated/api";
import betterAuthSchema from "../convex/betterAuth/schema";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const betterAuthModules = import.meta.glob("../convex/betterAuth/**/*.ts");
const processAccountEventRef = internal.appleNotifications.processAccountEvent;

type AuthAccount = {
  accountId: string;
  providerId: string;
  userId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
};

describe("Apple account-change processing", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
    t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  });

  test("revoked consent clears tokens and every session idempotently", async () => {
    const userId = await createUser(t, "revoked@example.com");
    await createAccount(t, {
      accountId: "apple-revoked",
      providerId: "apple",
      userId,
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
    });
    await createSession(t, userId, "session-one");
    await createSession(t, userId, "session-two");
    await createApprovedDeviceCode(t, userId, "revoked-device-code");

    await expect(
      t.action(processAccountEventRef, {
        event: { sub: "apple-revoked", type: "consent-revoked" },
        jti: "notification-revoked",
      }),
    ).resolves.toEqual({ disposition: "invalidate_apple", replayed: false });
    await expect(
      t.action(processAccountEventRef, {
        event: { sub: "apple-revoked", type: "consent-revoked" },
        jti: "notification-revoked",
      }),
    ).resolves.toEqual({ disposition: "invalidate_apple", replayed: true });

    const account = await findAccount(t, userId, "apple");
    expect(account).toMatchObject({
      accountId: "apple-revoked",
      accessToken: null,
      refreshToken: null,
    });
    expect(await findSessions(t, userId)).toEqual([]);
    expect(await findDeviceCodes(t, userId)).toEqual([]);
    expect(await findUser(t, userId)).not.toBeNull();
  });

  test("deleted Apple identity unlinks only Apple when another provider exists", async () => {
    const userId = await createUser(t, "linked@example.com");
    await createAccount(t, {
      accountId: "apple-linked",
      providerId: "apple",
      userId,
    });
    await createAccount(t, {
      accountId: "github-linked",
      providerId: "github",
      userId,
    });
    await createSession(t, userId, "linked-session");
    await createApprovedDeviceCode(t, userId, "linked-device-code");

    await expect(
      t.action(processAccountEventRef, {
        event: { sub: "apple-linked", type: "account-deleted" },
        jti: "notification-linked",
      }),
    ).resolves.toEqual({ disposition: "unlink_apple", replayed: false });

    expect(await findAccount(t, userId, "apple")).toBeNull();
    expect(await findAccount(t, userId, "github")).toMatchObject({
      accountId: "github-linked",
    });
    expect(await findSessions(t, userId)).toEqual([]);
    expect(await findDeviceCodes(t, userId)).toEqual([]);
    expect(await findUser(t, userId)).not.toBeNull();
  });

  test("deleted Apple-only identity removes auth and Wrapper-owned data", async () => {
    vi.useFakeTimers();
    try {
      const userId = await createUser(t, "apple-only@example.com");
      await createAccount(t, {
        accountId: "apple-only",
        providerId: "apple",
        userId,
      });
      await createSession(t, userId, "apple-only-session");
      const now = Date.now();
      await t.run(async (ctx) => {
        await ctx.db.insert("onboarding", {
          completedProfile: true,
          connectedCli: true,
          createdAt: now,
          sharedFirstSession: true,
          status: "completed",
          updatedAt: now,
          userId,
        });
        await ctx.db.insert("hostSession", {
          createdAt: now,
          cwd: "/review",
          lastHeartbeatAt: now,
          ownerUserId: userId,
          relayState: "online",
          sessionId: "APPLEDELETE1",
          shared: true,
          shell: "/bin/zsh",
          status: "active",
          updatedAt: now,
        });
      });

      await expect(
        t.action(processAccountEventRef, {
          event: { sub: "apple-only", type: "account-delete" },
          jti: "notification-delete",
        }),
      ).resolves.toEqual({ disposition: "delete_user", replayed: false });

      expect(await findUser(t, userId)).toBeNull();
      expect(await findAccount(t, userId, "apple")).toBeNull();
      expect(await findSessions(t, userId)).toEqual([]);
      await t.run(async (ctx) => {
        expect(
          await ctx.db
            .query("hostSession")
            .withIndex("by_owner", (query) => query.eq("ownerUserId", userId))
            .collect(),
        ).toEqual([]);
        expect(
          await ctx.db
            .query("onboarding")
            .withIndex("by_user", (query) => query.eq("userId", userId))
            .collect(),
        ).toEqual([]);
        const event = await ctx.db.query("appleAccountEvent").first();
        expect(event).toMatchObject({
          disposition: "delete_user",
          eventType: "account-delete",
          status: "processed",
        });
        expect(event?.userId).toBeUndefined();
        expect(JSON.stringify(event)).not.toContain("apple-only");
      });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  test("unknown identities and email events are accepted without account changes", async () => {
    await expect(
      t.action(processAccountEventRef, {
        event: { sub: "unknown-apple-user", type: "account-deleted" },
        jti: "notification-unknown",
      }),
    ).resolves.toEqual({ disposition: "account_not_found", replayed: false });
    await expect(
      t.action(processAccountEventRef, {
        event: { sub: "unknown-apple-user", type: "email-disabled" },
        jti: "notification-email",
      }),
    ).resolves.toEqual({ disposition: "ignored", replayed: false });
  });

  test("expires replay records without retaining current notifications", async () => {
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("appleAccountEvent", {
        createdAt: now - 91 * 24 * 60 * 60 * 1_000,
        eventIdHash: "expired-event",
        eventType: "consent-revoked",
        status: "processed",
        subjectHash: "expired-subject",
        updatedAt: now,
      });
      await ctx.db.insert("appleAccountEvent", {
        createdAt: now,
        eventIdHash: "current-event",
        eventType: "consent-revoked",
        status: "processed",
        subjectHash: "current-subject",
        updatedAt: now,
      });
    });

    await expect(
      t.mutation(internal.appleNotifications.cleanupProcessedEvents, {}),
    ).resolves.toEqual({
      deleted: 1,
      hasMore: false,
    });
    await t.run(async (ctx) => {
      const remaining = await ctx.db.query("appleAccountEvent").collect();
      expect(remaining.map((event) => event.eventIdHash)).toEqual(["current-event"]);
    });
  });
});

async function createUser(t: TestConvex<typeof schema>, email: string): Promise<string> {
  const now = Date.now();
  const user = (await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: now,
        email,
        emailVerified: true,
        name: "Apple Test User",
        updatedAt: now,
      },
      model: "user",
    },
  })) as { _id: string };
  return user._id;
}

async function createAccount(t: TestConvex<typeof schema>, account: AuthAccount): Promise<void> {
  const now = Date.now();
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        accountId: account.accountId,
        createdAt: now,
        providerId: account.providerId,
        updatedAt: now,
        userId: account.userId,
        ...(account.accessToken === undefined ? {} : { accessToken: account.accessToken }),
        ...(account.refreshToken === undefined ? {} : { refreshToken: account.refreshToken }),
      },
      model: "account",
    },
  });
}

async function createSession(
  t: TestConvex<typeof schema>,
  userId: string,
  token: string,
): Promise<void> {
  const now = Date.now();
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: now,
        expiresAt: now + 60_000,
        token,
        updatedAt: now,
        userId,
      },
      model: "session",
    },
  });
}

async function createApprovedDeviceCode(
  t: TestConvex<typeof schema>,
  userId: string,
  deviceCode: string,
): Promise<void> {
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        deviceCode,
        expiresAt: Date.now() + 60_000,
        status: "approved",
        userCode: deviceCode.toUpperCase(),
        userId,
      },
      model: "deviceCode",
    },
  });
}

async function findAccount(
  t: TestConvex<typeof schema>,
  userId: string,
  providerId: string,
): Promise<AuthAccount | null> {
  return (await t.query(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", operator: "eq", value: userId },
      { field: "providerId", operator: "eq", value: providerId },
    ],
  })) as AuthAccount | null;
}

async function findSessions(
  t: TestConvex<typeof schema>,
  userId: string,
): Promise<Array<{ token: string }>> {
  const result = (await t.query(components.betterAuth.adapter.findMany, {
    model: "session",
    paginationOpts: { cursor: null, numItems: 100 },
    where: [{ field: "userId", operator: "eq", value: userId }],
  })) as { page: Array<{ token: string }> };
  return result.page;
}

async function findDeviceCodes(
  t: TestConvex<typeof schema>,
  userId: string,
): Promise<Array<{ deviceCode: string }>> {
  const result = (await t.query(components.betterAuth.adapter.findMany, {
    model: "deviceCode",
    paginationOpts: { cursor: null, numItems: 100 },
    where: [{ field: "userId", operator: "eq", value: userId }],
  })) as { page: Array<{ deviceCode: string }> };
  return result.page;
}

async function findUser(
  t: TestConvex<typeof schema>,
  userId: string,
): Promise<{ email: string } | null> {
  return (await t.query(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", operator: "eq", value: userId }],
  })) as { email: string } | null;
}
