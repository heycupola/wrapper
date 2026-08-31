/**
 * Convex HTTP errors put the UDF message in `error.data`, not `error.message`.
 *
 * `createError()` throws `new ConvexError({ code, severity, message })`. The
 * HTTP client then reconstructs that as:
 *   message: "[Request ID: …] Server Error"
 *   data:    { code, severity, message }
 * Matching only `error.message` therefore misses expected denials such as
 * "Relay sharing requires Pro plan".
 */

export type ConvexErrorPayload = {
  code?: string;
  message?: string;
};

export function convexErrorPayload(error: unknown): ConvexErrorPayload {
  if (!error || typeof error !== "object") return {};
  let payload: unknown = "data" in error ? error.data : undefined;
  while (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.length === 0) return {};
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return { message: payload };
    }
  }
  if (!payload || typeof payload !== "object") return {};
  const record = payload as { code?: unknown; message?: unknown };
  return {
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
  };
}

/** Must match `packages/backend/convex/relay.ts` (`issueHostTicket`). */
const PRO_PLAN_REQUIRED_MESSAGE = "Relay sharing requires Pro plan";

export function isProPlanRequiredError(error: unknown): boolean {
  const payload = convexErrorPayload(error);
  if (payload.message?.includes(PRO_PLAN_REQUIRED_MESSAGE)) return true;
  if (error instanceof Error && error.message.includes(PRO_PLAN_REQUIRED_MESSAGE)) {
    return true;
  }
  return typeof error === "string" && error.includes(PRO_PLAN_REQUIRED_MESSAGE);
}
