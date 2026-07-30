/// <reference types="vite/client" />

import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { ErrorCode } from "../convex/lib/errors";
import { hashRelayTicket } from "../convex/lib/relayTicket";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const sessionId = "SECURESESSION1";

type ErrorPayload = {
  code?: string;
  message?: string;
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
  message?: string,
): Promise<ErrorPayload> {
  try {
    await operation();
  } catch (error) {
    const payload = parseErrorPayload(error);
    expect(payload.code).toBe(code);
    if (message) expect(payload.message).toBe(message);
    return payload;
  }
  throw new Error(`Expected ${code} error`);
}

describe("relay session access", () => {
  let t: TestConvex<typeof schema>;
  let owner: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
  let viewer: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    owner = t.withIdentity({
      subject: "owner-user",
      email: "owner@example.com",
      name: "Owner",
    });
    viewer = t.withIdentity({
      subject: "viewer-user",
      email: "viewer@example.com",
      name: "Viewer",
    });

    await owner.mutation(api.session.open, {
      sessionId,
      shell: "/bin/zsh",
      cwd: "/workspace/private",
      port: 43210,
      hostPid: 1234,
      shared: false,
    });
  });

  test("requires authentication and keeps active-session listing owner-scoped", async () => {
    await expectConvexError(
      () =>
        t.mutation(api.session.open, {
          sessionId: "ANONYMOUS1",
          shell: "/bin/zsh",
          cwd: "/tmp",
        }),
      ErrorCode.UNAUTHORIZED,
    );

    expect(await owner.query(api.session.listActive, {})).toHaveLength(1);
    expect(await viewer.query(api.session.listActive, {})).toEqual([]);
  });

  test("keeps local attach owner-only without revealing session existence", async () => {
    const authorized = await owner.query(api.session.authorizeAttach, { sessionId });
    expect(authorized).toMatchObject({ ok: true, isOwner: true, sessionId });

    const existingDenied = await expectConvexError(
      () => viewer.query(api.session.authorizeAttach, { sessionId }),
      ErrorCode.INSUFFICIENT_PERMISSION,
    );
    const unknownDenied = await expectConvexError(
      () => viewer.query(api.session.authorizeAttach, { sessionId: "DOESNOTEXIST" }),
      ErrorCode.INSUFFICIENT_PERMISSION,
    );
    expect(existingDenied.message).toBe("Session access denied");
    expect(unknownDenied.message).toBe("Session access denied");
  });

  test("allows owner without code and requires the exact code for a non-owner", async () => {
    const ownerTicket = await owner.action(api.relay.issueViewerTicket, { sessionId });
    expect(ownerTicket.ticket).toMatch(/^[0-9a-f]{64}$/);

    await expectConvexError(
      () => viewer.action(api.relay.issueViewerTicket, { sessionId }),
      ErrorCode.INSUFFICIENT_PERMISSION,
      "Session access denied",
    );

    await owner.mutation(api.session.setShareCode, {
      sessionId,
      code: "ABCD-EFGH",
    });

    await expectConvexError(
      () =>
        viewer.action(api.relay.issueViewerTicket, {
          sessionId,
          code: "WRONG-CODE",
        }),
      ErrorCode.INSUFFICIENT_PERMISSION,
      "Session access denied",
    );

    const viewerTicket = await viewer.action(api.relay.issueViewerTicket, {
      sessionId,
      code: "abcd efgh",
    });
    expect(viewerTicket.ticket).toMatch(/^[0-9a-f]{64}$/);
  });

  test("uses the same denial for unknown, unshared, missing-code, and wrong-code sessions", async () => {
    const errors = [
      await expectConvexError(
        () =>
          viewer.action(api.relay.issueViewerTicket, {
            sessionId: "DOESNOTEXIST",
          }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      ),
      await expectConvexError(
        () => viewer.action(api.relay.issueViewerTicket, { sessionId }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      ),
    ];

    await owner.mutation(api.session.setShareCode, { sessionId, code: "ABCD-EFGH" });
    errors.push(
      await expectConvexError(
        () => viewer.action(api.relay.issueViewerTicket, { sessionId }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      ),
      await expectConvexError(
        () =>
          viewer.action(api.relay.issueViewerTicket, {
            sessionId,
            code: "NOPE-NOPE",
          }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      ),
    );

    expect(errors.map((error) => error.message)).toEqual([
      "Session access denied",
      "Session access denied",
      "Session access denied",
      "Session access denied",
    ]);
  });

  test("makes tickets single-use and rejects an unconsumed ticket after unshare", async () => {
    await owner.mutation(api.session.setShareCode, { sessionId, code: "ABCD-EFGH" });
    const first = await viewer.action(api.relay.issueViewerTicket, {
      sessionId,
      code: "ABCD-EFGH",
    });

    const consumed = await t.mutation(api.relay.consumeTicket, { ticket: first.ticket });
    expect(consumed).toMatchObject({
      sessionId,
      role: "viewer",
      userId: "viewer-user",
    });
    await expectConvexError(
      () => t.mutation(api.relay.consumeTicket, { ticket: first.ticket }),
      ErrorCode.UNAUTHORIZED,
    );

    const second = await viewer.action(api.relay.issueViewerTicket, {
      sessionId,
      code: "ABCD-EFGH",
    });
    await owner.mutation(api.session.setShareCode, { sessionId });
    await expectConvexError(
      () => t.mutation(api.relay.consumeTicket, { ticket: second.ticket }),
      ErrorCode.INSUFFICIENT_PERMISSION,
    );
  });

  test("rejects expired tickets", async () => {
    const issued = await owner.action(api.relay.issueViewerTicket, { sessionId });
    const tokenHash = await hashRelayTicket(issued.ticket);

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("relayTicket")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .unique();
      if (!row) throw new Error("ticket row missing");
      await ctx.db.patch(row._id, { expiresAt: Date.now() - 1 });
    });

    await expectConvexError(
      () => t.mutation(api.relay.consumeTicket, { ticket: issued.ticket }),
      ErrorCode.UNAUTHORIZED,
    );
  });

  test("rate limits repeated non-owner attempts", async () => {
    await owner.mutation(api.session.setShareCode, { sessionId, code: "ABCD-EFGH" });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      // Sequential calls intentionally exercise the committed fixed-window count.
      // eslint-disable-next-line no-await-in-loop
      await expectConvexError(
        () =>
          viewer.action(api.relay.issueViewerTicket, {
            sessionId,
            code: "WRONG-CODE",
          }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      );
    }

    await expectConvexError(
      () =>
        viewer.action(api.relay.issueViewerTicket, {
          sessionId,
          code: "WRONG-CODE",
        }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
  });

  test("commits per-user, target-bucket, and global counters after a denied code", async () => {
    await owner.mutation(api.session.setShareCode, { sessionId, code: "ABCD-EFGH" });
    await expectConvexError(
      () =>
        viewer.action(api.relay.issueViewerTicket, {
          sessionId,
          code: "WRONG-CODE",
        }),
      ErrorCode.INSUFFICIENT_PERMISSION,
    );

    const rows = await t.run((ctx) => ctx.db.query("rateLimit").collect());
    const targetBucket = (await hashRelayTicket(sessionId)).slice(0, 4);
    expect(rows.map((row) => [row.key, row.count])).toEqual(
      expect.arrayContaining([
        ["issueViewerTicket:user:viewer-user", 1],
        [`issueViewerTicket:target:${targetBucket}`, 1],
        ["issueViewerTicket:global", 1],
      ]),
    );
  });

  test("rate limits unknown and existing targets through the same account path", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expectConvexError(
        () =>
          viewer.action(api.relay.issueViewerTicket, {
            sessionId: attempt % 2 === 0 ? sessionId : `UNKNOWN${attempt}`,
          }),
        ErrorCode.INSUFFICIENT_PERMISSION,
      );
    }

    await expectConvexError(
      () => viewer.action(api.relay.issueViewerTicket, { sessionId: "ANOTHERUNKNOWN" }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
    await expectConvexError(
      () => viewer.action(api.relay.issueViewerTicket, { sessionId }),
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
  });
});
