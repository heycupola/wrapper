/// <reference types="vite/client" />

import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { ErrorCode } from "../convex/lib/errors";
import { rateLimitKeys } from "../convex/lib/rateLimit";
import { sha256Hex } from "../convex/lib/releaseNotes";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

type ErrorPayload = { code?: string };

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

const baseIntake = {
  clientBucket: "client-a",
  source: "landing-questions",
  elapsedMs: 5_000,
};

describe("release-notes signup", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  test("stores a pending signup with hashed confirm token and schedules the email", async () => {
    const result = await t.mutation(api.releaseNotes.subscribe, {
      ...baseIntake,
      email: "  Dev@Example.COM ",
    });
    expect(result).toEqual({ status: "check_inbox" });

    const rows = await t.run((ctx) => ctx.db.query("releaseNoteSubscriber").collect());
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.email).toBe("dev@example.com");
    expect(row.status).toBe("pending");
    expect(row.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);
    expect(row.confirmExpiresAt).toBeGreaterThan(Date.now());
  });

  test("confirms once and unsubscribes cleanly", async () => {
    await t.mutation(api.releaseNotes.subscribe, {
      ...baseIntake,
      email: "confirm@example.com",
    });

    // Recover the plain token by planting a known one on the row.
    const token = "a".repeat(64);
    const tokenHash = await sha256Hex(token);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("releaseNoteSubscriber").first())!;
      await ctx.db.patch(row._id, { confirmTokenHash: tokenHash });
    });

    await expect(t.mutation(api.releaseNotes.confirm, { token })).resolves.toEqual({
      ok: true,
      email: "confirm@example.com",
      alreadyConfirmed: false,
    });
    // A second use of the same token is spent.
    await expect(t.mutation(api.releaseNotes.confirm, { token })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    const confirmed = await t.query(internal.releaseNotes._listConfirmed, {});
    expect(confirmed.map((row) => row.email)).toEqual(["confirm@example.com"]);

    const unsubscribeToken = await t.run(
      async (ctx) => (await ctx.db.query("releaseNoteSubscriber").first())!.unsubscribeToken,
    );
    await expect(
      t.mutation(api.releaseNotes.unsubscribe, { token: unsubscribeToken }),
    ).resolves.toEqual({ ok: true });
    await expect(
      t.mutation(api.releaseNotes.unsubscribe, { token: unsubscribeToken }),
    ).resolves.toEqual({ ok: true });

    expect(await t.query(internal.releaseNotes._listConfirmed, {})).toEqual([]);
  });

  test("rejects expired confirmation tokens", async () => {
    await t.mutation(api.releaseNotes.subscribe, {
      ...baseIntake,
      email: "late@example.com",
    });
    const token = "b".repeat(64);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("releaseNoteSubscriber").first())!;
      await ctx.db.patch(row._id, {
        confirmTokenHash: await sha256Hex(token),
        confirmExpiresAt: Date.now() - 1,
      });
    });
    await expect(t.mutation(api.releaseNotes.confirm, { token })).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });

  test("silently drops honeypot and too-fast submissions without touching the table", async () => {
    await expect(
      t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        email: "bot@example.com",
        honeypot: "http://spam.example",
      }),
    ).resolves.toEqual({ status: "check_inbox" });
    await expect(
      t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        elapsedMs: 200,
        email: "fast@example.com",
      }),
    ).resolves.toEqual({ status: "check_inbox" });

    expect(await t.run((ctx) => ctx.db.query("releaseNoteSubscriber").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("rateLimit").collect())).toEqual([]);
  });

  test("rejects malformed input before consuming any rate-limit budget", async () => {
    await expectConvexError(
      () => t.mutation(api.releaseNotes.subscribe, { ...baseIntake, email: "not-an-email" }),
      ErrorCode.INVALID_ARGUMENTS,
    );
    expect(await t.run((ctx) => ctx.db.query("rateLimit").collect())).toEqual([]);
  });

  test("limits one client to five signups an hour while other clients continue", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        email: `user${attempt}@example.com`,
      });
    }
    await expectConvexError(
      () => t.mutation(api.releaseNotes.subscribe, { ...baseIntake, email: "user6@example.com" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    await expect(
      t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        clientBucket: "client-b",
        email: "other@example.com",
      }),
    ).resolves.toEqual({ status: "check_inbox" });
  });

  test("limits confirmation resends to the same address", async () => {
    const buckets = ["c1", "c2", "c3", "c4"];
    for (const clientBucket of buckets.slice(0, 3)) {
      // eslint-disable-next-line no-await-in-loop
      await t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        clientBucket,
        email: "same@example.com",
      });
    }
    await expectConvexError(
      () =>
        t.mutation(api.releaseNotes.subscribe, {
          ...baseIntake,
          clientBucket: buckets[3]!,
          email: "same@example.com",
        }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    // Still one row: resends rotate the token instead of duplicating.
    expect(await t.run((ctx) => ctx.db.query("releaseNoteSubscriber").collect())).toHaveLength(1);
  });

  test("honours saturated global windows", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimit", {
        key: rateLimitKeys.releaseNotes.subscribeGlobalMinute,
        count: 40,
        resetAt: Date.now() + 60_000,
      });
    });
    await expectConvexError(
      () => t.mutation(api.releaseNotes.subscribe, { ...baseIntake, email: "global@example.com" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
  });

  test("requires the ingest secret when one is configured", async () => {
    const previous = process.env.RELEASE_NOTES_INGEST_SECRET;
    process.env.RELEASE_NOTES_INGEST_SECRET = "top-secret";
    try {
      await expectConvexError(
        () =>
          t.mutation(api.releaseNotes.subscribe, { ...baseIntake, email: "secret@example.com" }),
        ErrorCode.UNAUTHORIZED,
      );
      await expect(
        t.mutation(api.releaseNotes.subscribe, {
          ...baseIntake,
          ingestSecret: "top-secret",
          email: "secret@example.com",
        }),
      ).resolves.toEqual({ status: "check_inbox" });
    } finally {
      if (previous === undefined) delete process.env.RELEASE_NOTES_INGEST_SECRET;
      else process.env.RELEASE_NOTES_INGEST_SECRET = previous;
    }
  });

  test("keeps a confirmed address confirmed when it signs up again", async () => {
    await t.mutation(api.releaseNotes.subscribe, { ...baseIntake, email: "again@example.com" });
    const token = "c".repeat(64);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("releaseNoteSubscriber").first())!;
      await ctx.db.patch(row._id, { confirmTokenHash: await sha256Hex(token) });
    });
    await t.mutation(api.releaseNotes.confirm, { token });

    await expect(
      t.mutation(api.releaseNotes.subscribe, {
        ...baseIntake,
        clientBucket: "client-z",
        email: "again@example.com",
      }),
    ).resolves.toEqual({ status: "check_inbox" });

    const rows = await t.run((ctx) => ctx.db.query("releaseNoteSubscriber").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("confirmed");
    // A fresh confirm token is issued so the inbox flow looks identical.
    expect(rows[0]!.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("sweeps pending rows a week after their link expired", async () => {
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("releaseNoteSubscriber", {
        email: "old@example.com",
        source: "test",
        status: "pending",
        confirmTokenHash: "x",
        confirmExpiresAt: now - 8 * 24 * 60 * 60 * 1000,
        unsubscribeToken: "u1",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("releaseNoteSubscriber", {
        email: "fresh@example.com",
        source: "test",
        status: "pending",
        confirmTokenHash: "y",
        confirmExpiresAt: now + 60_000,
        unsubscribeToken: "u2",
        createdAt: now,
        updatedAt: now,
      });
    });
    await expect(t.mutation(internal.releaseNotes.sweepExpiredPending, {})).resolves.toEqual({
      deleted: 1,
      hasMore: false,
    });
    const remaining = await t.run((ctx) => ctx.db.query("releaseNoteSubscriber").collect());
    expect(remaining.map((row) => row.email)).toEqual(["fresh@example.com"]);
  });
});
