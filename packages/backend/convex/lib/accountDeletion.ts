export const AUTH_CLEANUP_PAGE_SIZE = 100;

type EqualityWhere<Field extends string> = {
  field: Field;
  operator: "eq";
  value: string;
};

export type AuthCleanupRequest =
  | {
      model: "account";
      where: [EqualityWhere<"userId">];
    }
  | {
      model: "deviceCode";
      where: [EqualityWhere<"userId">];
    }
  | {
      model: "verification";
      where: [EqualityWhere<"identifier" | "value">];
    };

export type DeletePageOptions = {
  cursor: string | null;
  numItems: number;
};

export type DeletePageResult = {
  continueCursor: string;
  count?: number;
  isDone: boolean;
  pageStatus?: string;
  splitCursor?: string | null;
};

type DeletePage = (paginationOpts: DeletePageOptions) => Promise<DeletePageResult>;

/**
 * Delete every matching page returned by a Convex paginated mutation.
 *
 * Better Auth's component limits one adapter deletion to a single page. This
 * loop deliberately fails closed if a malformed response cannot advance: the
 * user deletion can then be retried without leaving an active user with only
 * part of their credentials removed.
 */
export async function deleteAllPaginated(
  deletePage: DeletePage,
  pageSize = AUTH_CLEANUP_PAGE_SIZE,
): Promise<number> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new Error("Auth cleanup page size must be a positive integer");
  }

  let cursor: string | null = null;
  let deleted = 0;

  while (true) {
    // Each cursor is returned by the prior deletion page, so this cannot run in parallel.
    // eslint-disable-next-line no-await-in-loop
    const result = await deletePage({ cursor, numItems: pageSize });
    if (result.count !== undefined && (!Number.isSafeInteger(result.count) || result.count < 0)) {
      throw new Error("Auth cleanup returned an invalid deletion count");
    }
    deleted += result.count ?? 0;

    if (result.isDone) return deleted;

    const nextCursor =
      result.pageStatus === "SplitRecommended" || result.pageStatus === "SplitRequired"
        ? (result.splitCursor ?? result.continueCursor)
        : result.continueCursor;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error("Auth cleanup pagination did not advance");
    }
    cursor = nextCursor;
  }
}

export async function deleteAuthRecordsForUser(input: {
  deletePage: (
    request: AuthCleanupRequest,
    paginationOpts: DeletePageOptions,
  ) => Promise<DeletePageResult>;
  email: string;
  userId: string;
}): Promise<{
  accounts: number;
  deviceCodes: number;
  verificationsByEmail: number;
  verificationsByUserId: number;
}> {
  const deleteRequest = (request: AuthCleanupRequest) =>
    deleteAllPaginated((paginationOpts) => input.deletePage(request, paginationOpts));

  const accounts = await deleteRequest({
    model: "account",
    where: [{ field: "userId", operator: "eq", value: input.userId }],
  });
  const deviceCodes = await deleteRequest({
    model: "deviceCode",
    where: [{ field: "userId", operator: "eq", value: input.userId }],
  });
  const verificationsByUserId = await deleteRequest({
    model: "verification",
    where: [{ field: "value", operator: "eq", value: input.userId }],
  });
  const verificationsByEmail = await deleteRequest({
    model: "verification",
    where: [{ field: "identifier", operator: "eq", value: input.email }],
  });

  return {
    accounts,
    deviceCodes,
    verificationsByEmail,
    verificationsByUserId,
  };
}

export const BILLING_DELETE_MAX_ATTEMPTS = 4;
export const BILLING_DELETE_BASE_RETRY_DELAY_MS = 5 * 60 * 1_000;
export const BILLING_DELETE_MAX_RETRY_DELAY_MS = 30 * 60 * 1_000;

const ABSENT_BILLING_CUSTOMER_CODES = new Set([
  "customer_not_found",
  "not_found",
  "resource_not_found",
]);

const LOGGABLE_BILLING_ERROR_CODES = new Set([
  ...ABSENT_BILLING_CUSTOMER_CODES,
  "network_error",
  "rate_limit_exceeded",
  "request_timeout",
  "service_unavailable",
  "timeout",
  "unknown_error",
]);

function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.toLowerCase() : undefined;
}

function isSafeHttpStatus(statusCode: number | undefined): statusCode is number {
  return (
    statusCode !== undefined &&
    Number.isSafeInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
  );
}

export type BillingDeleteOutcome = "already_absent" | "deleted" | "retry";

export function classifyBillingDeleteResult(result: {
  error?: unknown | null;
  statusCode?: number;
}): BillingDeleteOutcome {
  if (result.error == null) return "deleted";
  if (result.statusCode === 404) return "already_absent";

  const code = extractErrorCode(result.error);
  return code && ABSENT_BILLING_CUSTOMER_CODES.has(code) ? "already_absent" : "retry";
}

export type BillingDeleteRetryDecision =
  | {
      shouldRetry: false;
    }
  | {
      delayMs: number;
      nextAttempt: number;
      shouldRetry: true;
    };

export function getBillingDeleteRetryDecision(attempt: number): BillingDeleteRetryDecision {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt >= BILLING_DELETE_MAX_ATTEMPTS) {
    return { shouldRetry: false };
  }

  return {
    delayMs: Math.min(
      BILLING_DELETE_BASE_RETRY_DELAY_MS * 2 ** (attempt - 1),
      BILLING_DELETE_MAX_RETRY_DELAY_MS,
    ),
    nextAttempt: attempt + 1,
    shouldRetry: true,
  };
}

/**
 * Return a bounded error label suitable for structured logs.
 *
 * Provider error messages and unknown error codes are intentionally excluded:
 * either can echo request data or credentials.
 */
export function toSafeBillingErrorCode(error: unknown, statusCode?: number): string {
  if (isSafeHttpStatus(statusCode)) return `http_${statusCode}`;

  const code = extractErrorCode(error);
  return code && LOGGABLE_BILLING_ERROR_CODES.has(code) ? code : "provider_error";
}

export function billingDeleteFailureLogData(input: {
  attempt: number;
  error: unknown;
  retryDelayMs?: number;
  statusCode?: number;
}): Record<string, number | string> {
  return {
    attempt: input.attempt,
    errorCode: toSafeBillingErrorCode(input.error, input.statusCode),
    maxAttempts: BILLING_DELETE_MAX_ATTEMPTS,
    ...(input.retryDelayMs === undefined ? {} : { retryDelayMs: input.retryDelayMs }),
  };
}
