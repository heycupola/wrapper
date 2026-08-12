/// <reference types="vite/client" />

import type { FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, components } from "../convex/_generated/api";
import betterAuthSchema from "../convex/betterAuth/schema";
import { ErrorCode } from "../convex/lib/errors";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const betterAuthModules = import.meta.glob("../convex/betterAuth/**/*.ts");
const cleanupExpiredDeviceCodes = (
  components.betterAuth as unknown as {
    deviceAuth: {
      cleanupExpiredDeviceCodes: FunctionReference<
        "mutation",
        "internal",
        Record<string, never>,
        { deleted: number; hasMore: boolean }
      >;
    };
  }
).deviceAuth.cleanupExpiredDeviceCodes;

type ErrorPayload = {
  code?: string;
};

function parseErrorPayload(error: unknown): ErrorPayload {
  if (!(error instanceof ConvexError)) return {};
  let payload: unknown = error.data;
  while (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return typeof payload === "object" && payload !== null ? (payload as ErrorPayload) : {};
}

async function expectConvexError(
  operation: () => Promise<unknown>,
  code: ErrorCode,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(parseErrorPayload(error).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code} error`);
}

describe("device authorization entry points", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
    t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  });

  test("moves a requested code through pending and denied states", async () => {
    const issued = await t.mutation(api.deviceAuth.requestDeviceCode, {
      clientId: "wrapper-cli",
      scope: "openid profile",
    });

    expect(issued.device_code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(issued.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(issued.verification_uri).toBe("https://www.wrapper.sh/oauth/authorize");
    expect(issued.verification_uri_complete).toBe(
      `https://www.wrapper.sh/oauth/authorize?user_code=${issued.user_code}`,
    );
    expect(issued).toMatchObject({ expires_in: 1_800, interval: 5 });

    expect(
      await t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: issued.user_code }),
    ).toEqual({
      userCode: issued.user_code,
      clientId: "wrapper-cli",
      scope: "openid profile",
      status: "pending",
    });

    await expectConvexError(
      () => t.mutation(api.deviceAuth.denyDeviceCode, { user_code: issued.user_code }),
      ErrorCode.UNAUTHORIZED,
    );

    const signedIn = t.withIdentity({
      subject: "signed-in-user",
      email: "user@example.com",
      name: "Signed In User",
    });
    await expect(
      signedIn.mutation(api.deviceAuth.denyDeviceCode, { user_code: issued.user_code }),
    ).resolves.toEqual({ success: true });

    expect(
      await t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: issued.user_code }),
    ).toMatchObject({ status: "denied" });
    await expect(
      t.mutation(api.deviceAuth.pollDeviceToken, { device_code: issued.device_code }),
    ).resolves.toEqual({ error: "access_denied" });
    expect(
      await t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: issued.user_code }),
    ).toBeNull();
  });

  test("commits pending poll pacing and rate-limit state", async () => {
    const issued = await t.mutation(api.deviceAuth.requestDeviceCode, {
      clientId: "polling-client",
    });

    await expect(
      t.mutation(api.deviceAuth.pollDeviceToken, { device_code: issued.device_code }),
    ).resolves.toEqual({ error: "authorization_pending" });
    await expect(
      t.mutation(api.deviceAuth.pollDeviceToken, { device_code: issued.device_code }),
    ).resolves.toEqual({ error: "slow_down" });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("rateLimit")
        .withIndex("by_key", (query) => query.eq("key", "pollDeviceToken:global"))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(2);
  });

  test("removes expired device codes in an idempotent indexed cleanup", async () => {
    const now = Date.now();
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "deviceCode",
        data: {
          deviceCode: "expired-device-code",
          expiresAt: now - 1,
          status: "pending",
          userCode: "EXPIRED1",
        },
      },
    });
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "deviceCode",
        data: {
          deviceCode: "active-device-code",
          expiresAt: now + 60_000,
          status: "pending",
          userCode: "ACTIVE01",
        },
      },
    });

    await expect(t.mutation(cleanupExpiredDeviceCodes, {})).resolves.toEqual({
      deleted: 1,
      hasMore: false,
    });
    await expect(t.mutation(cleanupExpiredDeviceCodes, {})).resolves.toEqual({
      deleted: 0,
      hasMore: false,
    });

    const remaining = (await t.query(components.betterAuth.adapter.findMany, {
      model: "deviceCode",
      paginationOpts: { cursor: null, numItems: 10 },
    })) as { page: Array<{ deviceCode: string }> };
    expect(remaining.page.map((row) => row.deviceCode)).toEqual(["active-device-code"]);
  });

  test("approves a code for the authenticated component user and issues a session token", async () => {
    const issued = await t.mutation(api.deviceAuth.requestDeviceCode, {
      clientId: "wrapper-cli",
    });
    const now = Date.now();
    const componentUser = (await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Approved User",
          email: "approved@example.com",
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    })) as { _id: string };

    const signedIn = t.withIdentity({
      subject: componentUser._id,
      email: "approved@example.com",
      name: "Approved User",
    });
    await signedIn.mutation(api.deviceAuth.approveDeviceCode, {
      user_code: issued.user_code,
    });

    expect(
      await t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: issued.user_code }),
    ).toMatchObject({ status: "approved" });

    const token = await t.mutation(api.deviceAuth.pollDeviceToken, {
      device_code: issued.device_code,
    });
    expect(token.session_token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).toMatchObject({
      token_type: "Bearer",
      expires_in: 30 * 24 * 60 * 60,
    });
    expect(
      await t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: issued.user_code }),
    ).toBeNull();
  });

  test("enforces the per-client request window while leaving other clients available", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // Sequential requests exercise the committed fixed-window counter.
      // eslint-disable-next-line no-await-in-loop
      await t.mutation(api.deviceAuth.requestDeviceCode, { clientId: "busy-client" });
    }

    await expectConvexError(
      () => t.mutation(api.deviceAuth.requestDeviceCode, { clientId: "busy-client" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    await expect(
      t.mutation(api.deviceAuth.requestDeviceCode, { clientId: "other-client" }),
    ).resolves.toMatchObject({ expires_in: 1_800 });
  });

  test("rejects saturated global request, poll, and lookup windows before component work", async () => {
    const resetAt = Date.now() + 60_000;
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimit", {
        key: "requestDeviceCode:global",
        count: 120,
        resetAt,
      });
      await ctx.db.insert("rateLimit", {
        key: "pollDeviceToken:global",
        count: 600,
        resetAt,
      });
      await ctx.db.insert("rateLimit", {
        key: "getDeviceCodeInfo:global",
        count: 300,
        resetAt,
      });
    });

    await expectConvexError(
      () => t.mutation(api.deviceAuth.requestDeviceCode, { clientId: "new-client" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    await expectConvexError(
      () => t.mutation(api.deviceAuth.pollDeviceToken, { device_code: "unknown" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    await expectConvexError(
      () => t.mutation(api.deviceAuth.getDeviceCodeInfo, { user_code: "UNKNOWN" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );

    const rows = await t.run((ctx) => ctx.db.query("rateLimit").collect());
    expect(rows.some((row) => row.key === "requestDeviceCode:client:new-client")).toBe(false);
  });
});
