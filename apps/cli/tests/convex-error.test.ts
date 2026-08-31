import { describe, expect, test } from "bun:test";
import { convexErrorPayload, isProPlanRequiredError } from "../util/convex-error";

function httpConvexError(message: string, data: unknown): Error & { data: unknown } {
  const error = new Error(message) as Error & { data: unknown };
  error.name = "ConvexError";
  error.data = data;
  return error;
}

describe("convexErrorPayload", () => {
  test("reads code and message from ConvexError.data", () => {
    const error = httpConvexError("[Request ID: abc] Server Error", {
      code: "INSUFFICIENT_PERMISSION",
      severity: "high",
      message: "Relay sharing requires Pro plan",
    });

    expect(convexErrorPayload(error)).toEqual({
      code: "INSUFFICIENT_PERMISSION",
      message: "Relay sharing requires Pro plan",
    });
  });

  test("parses JSON string payloads", () => {
    const error = httpConvexError(
      "[Request ID: abc] Server Error",
      JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Please sign in to continue",
      }),
    );

    expect(convexErrorPayload(error)).toEqual({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue",
    });
  });

  test("returns empty for a generic Error", () => {
    expect(convexErrorPayload(new Error("[Request ID: abc] Server Error"))).toEqual({});
  });
});

describe("isProPlanRequiredError", () => {
  test("detects the HTTP-client ConvexError shape from logs", () => {
    const error = httpConvexError("[Request ID: b78358712ca0376b] Server Error", {
      code: "INSUFFICIENT_PERMISSION",
      message: "Relay sharing requires Pro plan",
    });

    expect(isProPlanRequiredError(error)).toBe(true);
  });

  test("detects the phrase on Error.message as a fallback", () => {
    expect(isProPlanRequiredError(new Error("Relay sharing requires Pro plan"))).toBe(true);
  });

  test("does not treat a generic Server Error as a Pro denial", () => {
    const error = httpConvexError("[Request ID: abc] Server Error", {
      code: "RESOURCE_NOT_FOUND",
      message: "Active session not found",
    });

    expect(isProPlanRequiredError(error)).toBe(false);
    expect(isProPlanRequiredError(new Error("[Request ID: abc] Server Error"))).toBe(false);
  });
});
