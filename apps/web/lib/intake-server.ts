import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";

/**
 * Server side of the landing-page intake. The browser never talks to Convex
 * directly for these; the route handler adds a hashed client address so the
 * backend can rate-limit per visitor, and signs the call with a shared secret
 * so nobody can skip that hop and pick their own bucket.
 */

const INGEST_SECRET = process.env.RELEASE_NOTES_INGEST_SECRET;

export type IntakeFailure = {
  code: "invalid" | "rate_limited" | "unavailable";
  message: string;
  status: 400 | 429 | 503;
};

type IntakeArgs = {
  ingestSecret?: string;
  clientBucket: string;
  source: string;
  honeypot?: string;
  elapsedMs?: number;
};

export const subscribeRef = makeFunctionReference<
  "mutation",
  IntakeArgs & { email: string },
  { status: "check_inbox" }
>("releaseNotes:subscribe");

export function convexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

/** Salted, truncated hash of the caller's address. Never stores the raw IP. */
export function clientBucket(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  return createHash("sha256")
    .update(`${INGEST_SECRET ?? "wrapper-intake"}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

export function intakeContext(request: Request, body: Record<string, unknown>): IntakeArgs {
  return {
    ingestSecret: INGEST_SECRET,
    clientBucket: clientBucket(request),
    source: clampString(body.source, 40) || "web",
    honeypot: clampString(body.honeypot, 200),
    elapsedMs:
      typeof body.elapsedMs === "number" && Number.isFinite(body.elapsedMs)
        ? Math.max(0, Math.floor(body.elapsedMs))
        : undefined,
  };
}

export function clampString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Map a Convex failure onto a response the form can show. */
export function intakeFailure(error: unknown): IntakeFailure {
  if (error instanceof ConvexError) {
    let payload: unknown = error.data;
    while (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        break;
      }
    }
    const data =
      typeof payload === "object" && payload !== null
        ? (payload as { code?: string; message?: string; retryAfterMs?: number })
        : {};
    if (data.code === "RATE_LIMIT_EXCEEDED") {
      const seconds = Math.max(1, Math.ceil((data.retryAfterMs ?? 60_000) / 1000));
      return {
        code: "rate_limited",
        message:
          seconds >= 120
            ? "Too many attempts from here. Try again later."
            : `Too many attempts. Try again in ${seconds}s.`,
        status: 429,
      };
    }
    if (data.code === "INVALID_ARGUMENTS") {
      return {
        code: "invalid",
        message: data.message ?? "Check the form and try again.",
        status: 400,
      };
    }
  }
  return {
    code: "unavailable",
    message: "Something went wrong on our side. Try again in a minute.",
    status: 503,
  };
}

export function failureResponse(failure: IntakeFailure, extra?: Record<string, unknown>): Response {
  const headers: Record<string, string> = { "cache-control": "no-store" };
  return Response.json(
    { ...extra, code: failure.code, message: failure.message },
    { status: failure.status, headers },
  );
}
