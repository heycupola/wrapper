/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const isProcessedRef = makeFunctionReference<
  "query",
  { eventId: string; source: "autumn" | "resend" },
  boolean
>("webhook:_isProcessed");
const claimEventRef = makeFunctionReference<
  "mutation",
  { eventId: string; source: "autumn" | "resend" },
  { claimed: boolean }
>("webhook:_claimEvent");
const releaseClaimRef = makeFunctionReference<
  "mutation",
  { eventId: string; source: "autumn" | "resend" },
  null
>("webhook:_releaseClaim");
const cleanupOldEventsRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { deleted: number }
>("webhook:_cleanupOldEvents");
const upgradeToProRef = makeFunctionReference<"mutation", { userId: string }, { success: boolean }>(
  "user:_upgradeToPro",
);
const downgradeToFreeRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { success: boolean; newlyDowngraded: boolean; gracePeriodEmailSent: boolean }
>("user:_downgradeToFree");
const loadUsersToRestrictRef = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    success: boolean;
    usersToRestrict: Array<{ userId: string; accessRestrictedEmailSent?: boolean }>;
  }
>("user:_loadUsersToRestrict");

describe("email webhook and plan state", () => {
  test("marks webhook events processed once", async () => {
    const t = convexTest(schema, modules);

    expect(await t.query(isProcessedRef, { eventId: "evt_1", source: "autumn" })).toBe(false);

    expect(await t.mutation(claimEventRef, { eventId: "evt_1", source: "autumn" })).toEqual({
      claimed: true,
    });
    expect(await t.mutation(claimEventRef, { eventId: "evt_1", source: "autumn" })).toEqual({
      claimed: false,
    });
    expect(await t.query(isProcessedRef, { eventId: "evt_1", source: "autumn" })).toBe(true);
    expect(await t.query(isProcessedRef, { eventId: "evt_1", source: "resend" })).toBe(false);

    await t.mutation(releaseClaimRef, { eventId: "evt_1", source: "autumn" });
    expect(await t.query(isProcessedRef, { eventId: "evt_1", source: "autumn" })).toBe(false);
    expect(await t.mutation(claimEventRef, { eventId: "evt_1", source: "autumn" })).toEqual({
      claimed: true,
    });
  });

  test("cleans webhook events older than 72 hours", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("processedWebhook", {
        eventId: "old",
        source: "resend",
        processedAt: Date.now() - 73 * 60 * 60 * 1000,
      });
      await ctx.db.insert("processedWebhook", {
        eventId: "fresh",
        source: "autumn",
        processedAt: Date.now(),
      });
    });

    const result = await t.mutation(cleanupOldEventsRef, {});
    expect(result).toEqual({ deleted: 1 });
    expect(await t.query(isProcessedRef, { eventId: "old", source: "resend" })).toBe(false);
    expect(await t.query(isProcessedRef, { eventId: "fresh", source: "autumn" })).toBe(true);
  });

  test("restricts users seven days after downgrade and not after upgrade", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(downgradeToFreeRef, { userId: "stale-user" });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("emailState")
        .withIndex("by_user", (query) => query.eq("userId", "stale-user"))
        .first();
      if (!row) throw new Error("missing email state");
      await ctx.db.patch(row._id, {
        planDowngradedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });
    });
    await t.mutation(downgradeToFreeRef, { userId: "fresh-user" });
    await t.mutation(upgradeToProRef, { userId: "stale-user" });
    await t.mutation(downgradeToFreeRef, { userId: "ready-user" });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("emailState")
        .withIndex("by_user", (query) => query.eq("userId", "ready-user"))
        .first();
      if (!row) throw new Error("missing email state");
      await ctx.db.patch(row._id, {
        planDowngradedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      });
    });

    const loaded = await t.query(loadUsersToRestrictRef, {});
    expect(loaded.usersToRestrict.map((row) => row.userId)).toEqual(["ready-user"]);
  });

  test("repeated downgrade keeps the original grace timer and send flags", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(downgradeToFreeRef, { userId: "same-user" });
    expect(first).toEqual({
      success: true,
      newlyDowngraded: true,
      gracePeriodEmailSent: false,
    });

    let originalTs = 0;
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("emailState")
        .withIndex("by_user", (query) => query.eq("userId", "same-user"))
        .first();
      if (!row?.planDowngradedAt) throw new Error("missing grace timestamp");
      originalTs = row.planDowngradedAt;
      await ctx.db.patch(row._id, { gracePeriodEmailSent: true });
    });

    const second = await t.mutation(downgradeToFreeRef, { userId: "same-user" });
    expect(second).toEqual({
      success: true,
      newlyDowngraded: false,
      gracePeriodEmailSent: true,
    });

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("emailState")
        .withIndex("by_user", (query) => query.eq("userId", "same-user"))
        .first();
      expect(row?.planDowngradedAt).toBe(originalTs);
      expect(row?.gracePeriodEmailSent).toBe(true);
      expect(row?.accessRestrictedEmailSent).toBeUndefined();
    });
  });
});
