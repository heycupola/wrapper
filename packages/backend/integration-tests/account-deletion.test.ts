/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { rateLimitKeys } from "../convex/lib/rateLimit";

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
      await ctx.db.insert("relayTicket", {
        tokenHash: "owned-session-viewer-ticket",
        sessionId: "DELETESESSION",
        role: "viewer",
        userId: "keep-user",
        createdAt: now,
        expiresAt: now + 60_000,
      });
      await ctx.db.insert("hostSession", {
        sessionId: "KEEPSESSION",
        ownerUserId: "keep-user",
        shell: "/bin/zsh",
        cwd: "/public",
        shared: true,
        shareCodeHash: "keep-hash",
        relayState: "online",
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastHeartbeatAt: now,
      });
      await ctx.db.insert("relayTicket", {
        tokenHash: "deleting-user-viewer-ticket",
        sessionId: "KEEPSESSION",
        role: "viewer",
        userId: "delete-user",
        createdAt: now,
        expiresAt: now + 60_000,
      });
      await ctx.db.insert("relayTicket", {
        tokenHash: "keep-ticket",
        sessionId: "KEEPSESSION",
        role: "host",
        userId: "keep-user",
        createdAt: now,
        expiresAt: now + 60_000,
      });
      const userRateLimitKey = rateLimitKeys.issueViewerTicketForUser("delete-user");
      await ctx.db.insert("rateLimit", {
        key: userRateLimitKey,
        count: 1,
        resetAt: now + 60_000,
      });
      // Defensive cleanup removes duplicate exact-key rows without scanning the
      // table, while deliberately preserving keys that merely share a prefix.
      await ctx.db.insert("rateLimit", {
        key: userRateLimitKey,
        count: 1,
        resetAt: now + 60_000,
      });
      await ctx.db.insert("rateLimit", {
        key: rateLimitKeys.issueViewerTicketForUser("delete-user-extra"),
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

    const firstDeletion = await t.mutation(deleteOwnedDataRef, {
      userId: "delete-user",
    });
    const repeatedDeletion = await t.mutation(deleteOwnedDataRef, {
      userId: "delete-user",
    });

    expect(firstDeletion).toEqual({
      onboardingRows: 1,
      relayTickets: 3,
      sessions: 1,
    });
    expect(repeatedDeletion).toEqual({
      onboardingRows: 0,
      relayTickets: 0,
      sessions: 0,
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
        await ctx.db
          .query("rateLimit")
          .withIndex("by_key", (query) =>
            query.eq("key", rateLimitKeys.issueViewerTicketForUser("delete-user")),
          )
          .collect(),
      ).toEqual([]);
      expect(
        await ctx.db
          .query("rateLimit")
          .withIndex("by_key", (query) =>
            query.eq("key", rateLimitKeys.issueViewerTicketForUser("delete-user-extra")),
          )
          .first(),
      ).not.toBeNull();
      expect(
        await ctx.db
          .query("hostSession")
          .withIndex("by_owner", (query) => query.eq("ownerUserId", "keep-user"))
          .first(),
      ).not.toBeNull();
      const keptSessionTickets = await ctx.db
        .query("relayTicket")
        .withIndex("by_session_role", (query) =>
          query.eq("sessionId", "KEEPSESSION").eq("role", "host"),
        )
        .collect();
      expect(keptSessionTickets.map((ticket) => ticket.tokenHash)).toEqual(["keep-ticket"]);
      expect(
        await ctx.db
          .query("onboarding")
          .withIndex("by_user", (query) => query.eq("userId", "keep-user"))
          .first(),
      ).not.toBeNull();
    });
  });
});
