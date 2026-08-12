import { describe, expect, test } from "bun:test";
import {
  AUTH_CLEANUP_PAGE_SIZE,
  BILLING_DELETE_BASE_RETRY_DELAY_MS,
  BILLING_DELETE_MAX_ATTEMPTS,
  billingDeleteFailureLogData,
  classifyBillingDeleteResult,
  deleteAllPaginated,
  deleteAuthRecordsForUser,
  getBillingDeleteRetryDecision,
} from "../convex/lib/accountDeletion";
import { getUserRateLimitKeys, rateLimitKeys } from "../convex/lib/rateLimit";

describe("account deletion helpers", () => {
  test("deletes every auth page beyond the first 100 rows", async () => {
    const seenCursors: Array<string | null> = [];
    const pages = [
      { continueCursor: "page-2", count: 100, isDone: false },
      { continueCursor: "page-3", count: 100, isDone: false },
      { continueCursor: "", count: 37, isDone: true },
    ];

    const deleted = await deleteAllPaginated(async (paginationOpts) => {
      expect(paginationOpts.numItems).toBe(AUTH_CLEANUP_PAGE_SIZE);
      seenCursors.push(paginationOpts.cursor);
      const page = pages.shift();
      if (!page) throw new Error("Unexpected extra deletion page");
      return page;
    });

    expect(deleted).toBe(237);
    expect(seenCursors).toEqual([null, "page-2", "page-3"]);
  });

  test("uses a split cursor and rejects pagination that cannot advance", async () => {
    const seenCursors: Array<string | null> = [];
    const deleted = await deleteAllPaginated(async ({ cursor }) => {
      seenCursors.push(cursor);
      if (cursor === null) {
        return {
          continueCursor: "ordinary-cursor",
          count: 10,
          isDone: false,
          pageStatus: "SplitRequired",
          splitCursor: "split-cursor",
        };
      }
      return { continueCursor: "", count: 2, isDone: true };
    });

    expect(deleted).toBe(12);
    expect(seenCursors).toEqual([null, "split-cursor"]);
    await expect(
      deleteAllPaginated(async () => ({
        continueCursor: "",
        count: 0,
        isDone: false,
      })),
    ).rejects.toThrow("Auth cleanup pagination did not advance");
  });

  test("cleans every auth record category and is idempotent", async () => {
    const remaining = new Map<string, number>();
    for (const key of [
      "account:userId",
      "deviceCode:userId",
      "verification:value",
      "verification:identifier",
    ]) {
      remaining.set(key, 205);
    }

    const deletePage = async (
      request: Parameters<Parameters<typeof deleteAuthRecordsForUser>[0]["deletePage"]>[0],
      paginationOpts: Parameters<Parameters<typeof deleteAuthRecordsForUser>[0]["deletePage"]>[1],
    ) => {
      const key = `${request.model}:${request.where[0].field}`;
      const before = remaining.get(key) ?? 0;
      const count = Math.min(before, paginationOpts.numItems);
      const after = before - count;
      remaining.set(key, after);
      return {
        continueCursor: after === 0 ? "" : `${key}:${after}`,
        count,
        isDone: after === 0,
      };
    };

    const first = await deleteAuthRecordsForUser({
      deletePage,
      email: "delete@example.com",
      userId: "delete-user",
    });
    expect(first).toEqual({
      accounts: 205,
      deviceCodes: 205,
      verificationsByEmail: 205,
      verificationsByUserId: 205,
    });

    const second = await deleteAuthRecordsForUser({
      deletePage,
      email: "delete@example.com",
      userId: "delete-user",
    });
    expect(second).toEqual({
      accounts: 0,
      deviceCodes: 0,
      verificationsByEmail: 0,
      verificationsByUserId: 0,
    });
  });

  test("bounds billing retries and treats an absent customer as success", () => {
    expect(getBillingDeleteRetryDecision(1)).toEqual({
      delayMs: BILLING_DELETE_BASE_RETRY_DELAY_MS,
      nextAttempt: 2,
      shouldRetry: true,
    });
    expect(getBillingDeleteRetryDecision(3)).toEqual({
      delayMs: BILLING_DELETE_BASE_RETRY_DELAY_MS * 4,
      nextAttempt: 4,
      shouldRetry: true,
    });
    expect(getBillingDeleteRetryDecision(BILLING_DELETE_MAX_ATTEMPTS)).toEqual({
      shouldRetry: false,
    });
    expect(getBillingDeleteRetryDecision(0)).toEqual({ shouldRetry: false });

    expect(classifyBillingDeleteResult({ error: null })).toBe("deleted");
    expect(
      classifyBillingDeleteResult({
        error: { code: "customer_not_found", message: "missing" },
      }),
    ).toBe("already_absent");
    expect(
      classifyBillingDeleteResult({
        error: { code: "unknown_error", message: "missing" },
        statusCode: 404,
      }),
    ).toBe("already_absent");
    expect(
      classifyBillingDeleteResult({
        error: { code: "service_unavailable", message: "offline" },
        statusCode: 503,
      }),
    ).toBe("retry");
  });

  test("never copies provider messages or unknown codes into billing logs", () => {
    const secret = "sk_live_sensitive_billing_secret";
    const unknownCodeLog = billingDeleteFailureLogData({
      attempt: 1,
      error: { code: secret, message: `provider echoed ${secret}` },
    });
    const httpLog = billingDeleteFailureLogData({
      attempt: 2,
      error: { code: secret, message: `provider echoed ${secret}` },
      statusCode: 503,
    });

    expect(unknownCodeLog.errorCode).toBe("provider_error");
    expect(httpLog.errorCode).toBe("http_503");
    expect(JSON.stringify([unknownCodeLog, httpLog])).not.toContain(secret);
  });

  test("derives account cleanup keys from the same exact rate-limit key builder", () => {
    const key = rateLimitKeys.issueViewerTicketForUser("user-123");
    expect(key).toBe("issueViewerTicket:user:user-123");
    expect(getUserRateLimitKeys("user-123")).toEqual([key]);
  });
});
