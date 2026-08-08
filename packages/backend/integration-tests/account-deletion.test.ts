/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deleteOwnedDataRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { sessions: number; onboardingRows: number; relayTickets: number }
>("account:deleteOwnedData");

describe("account deletion cleanup", () => {
  test("removes user-owned application data without affecting other users", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("onboarding", {
        userId: "delete-user",
        completedProfile: true,
        connectedCli: true,
        sharedFirstSession: true,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("hostSession", {
        sessionId: "DELETESESSION",
        ownerUserId: "delete-user",
        shell: "/bin/zsh",
        cwd: "/private",
        shared: true,
        shareCodeHash: "hash",
        relayState: "online",
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastHeartbeatAt: now,
      });
      await ctx.db.insert("relayTicket", {
        tokenHash: "owned-ticket",
        sessionId: "DELETESESSION",
        role: "host",
        userId: "delete-user",
        createdAt: now,
        expiresAt: now + 60_000,
      });
      await ctx.db.insert("rateLimit", {
        key: "issueViewerTicket:user:delete-user",
        count: 1,
        resetAt: now + 60_000,
      });
      await ctx.db.insert("onboarding", {
        userId: "keep-user",
        completedProfile: false,
        connectedCli: false,
        sharedFirstSession: false,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(deleteOwnedDataRef, {
      userId: "delete-user",
    });

    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("hostSession")
          .withIndex("by_owner", (query) => query.eq("ownerUserId", "delete-user"))
          .collect(),
      ).toEqual([]);
      expect(
        await ctx.db
          .query("onboarding")
          .withIndex("by_user", (query) => query.eq("userId", "delete-user"))
          .collect(),
      ).toEqual([]);
      expect(
        await ctx.db
          .query("relayTicket")
          .withIndex("by_user", (query) => query.eq("userId", "delete-user"))
          .collect(),
      ).toEqual([]);
      expect(
        (await ctx.db.query("rateLimit").collect()).some((row) => row.key.includes("delete-user")),
      ).toBe(false);
      expect(
        await ctx.db
          .query("onboarding")
          .withIndex("by_user", (query) => query.eq("userId", "keep-user"))
          .first(),
      ).not.toBeNull();
    });
  });
});
