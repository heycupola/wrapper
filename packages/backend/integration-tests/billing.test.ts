/// <reference types="vite/client" />

import { Autumn } from "@useautumn/convex";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { ErrorCode } from "../convex/lib/errors";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const originalPlanId = process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
const queueBillingCustomerDeletionRef = makeFunctionReference<
  "mutation",
  { userId: string },
  { queued: boolean }
>("account:queueBillingCustomerDeletion");
const deleteBillingCustomerRef = makeFunctionReference<
  "action",
  { attempt: number; userId: string },
  {
    alreadyAbsent: boolean;
    attempt: number;
    retryScheduled: boolean;
    succeeded: boolean;
  }
>("account:deleteBillingCustomer");

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
): Promise<ErrorPayload> {
  try {
    await operation();
  } catch (error) {
    const payload = parseErrorPayload(error);
    expect(payload.code).toBe(code);
    return payload;
  }
  throw new Error(`Expected ${code} error`);
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalPlanId === undefined) {
    delete process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
  } else {
    process.env.WRAPPER_AUTUMN_PRO_PLAN_ID = originalPlanId;
  }
});

describe("billing checkout entry point", () => {
  test("requires authentication before contacting the billing provider", async () => {
    const attach = vi.spyOn(Autumn.prototype, "attach");
    const t = convexTest(schema, modules);

    await expectConvexError(
      () => t.action(api.billing.createProCheckout, {}),
      ErrorCode.UNAUTHORIZED,
    );
    expect(attach).not.toHaveBeenCalled();
  });

  test("forwards the trimmed plan and caller success URL", async () => {
    process.env.WRAPPER_AUTUMN_PRO_PLAN_ID = "  team-pro  ";
    const attach = vi.spyOn(Autumn.prototype, "attach").mockResolvedValue({
      data: { checkout_url: "https://checkout.stripe.com/c/pay/cs_test_123" },
      error: null,
    } as never);
    const t = convexTest(schema, modules).withIdentity({
      subject: "billing-user",
      email: "billing@example.com",
      name: "Billing User",
    });

    await expect(
      t.action(api.billing.createProCheckout, {
        successUrl: "https://www.wrapper.sh/onboarding?upgraded=1",
      }),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach.mock.calls[0]?.[1]).toEqual({
      productId: "team-pro",
      forceCheckout: true,
      successUrl: "https://www.wrapper.sh/onboarding?upgraded=1",
    });
  });

  test("uses the default plan and omits an absent success URL", async () => {
    delete process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
    const attach = vi.spyOn(Autumn.prototype, "attach").mockResolvedValue({
      data: { checkout_url: "https://checkout.stripe.com/c/pay/cs_test_default" },
      error: null,
    } as never);
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    await t.action(api.billing.createProCheckout, {});

    expect(attach.mock.calls[0]?.[1]).toEqual({
      productId: "pro",
      forceCheckout: true,
    });
  });

  test("rejects invalid argument types before contacting the provider", async () => {
    const attach = vi.spyOn(Autumn.prototype, "attach");
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    await expect(
      t.action(api.billing.createProCheckout, { successUrl: 42 } as never),
    ).rejects.toThrow();
    expect(attach).not.toHaveBeenCalled();
  });

  test("rejects checkout return URLs outside the configured app origin", async () => {
    const attach = vi.spyOn(Autumn.prototype, "attach");
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    const payload = await expectConvexError(
      () =>
        t.action(api.billing.createProCheckout, {
          successUrl: "https://attacker.example/finished",
        }),
      ErrorCode.INVALID_ARGUMENTS,
    );
    expect(payload.message).toBe("Invalid checkout return URL");
    expect(attach).not.toHaveBeenCalled();
  });

  test("maps missing checkout data to the external-service error contract", async () => {
    vi.spyOn(Autumn.prototype, "attach").mockResolvedValue({
      data: null,
      error: { message: "provider unavailable" },
    } as never);
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    const payload = await expectConvexError(
      () => t.action(api.billing.createProCheckout, {}),
      ErrorCode.EXTERNAL_SERVICE_ERROR,
    );
    expect(payload.message).toBe("Unable to start Pro checkout");
  });
});

describe("billing portal entry point", () => {
  test("requires authentication before contacting the billing provider", async () => {
    const getAuthParams = vi.spyOn(Autumn.prototype, "getAuthParams");
    const t = convexTest(schema, modules);

    await expectConvexError(
      () => t.action(api.billing.createBillingPortal, {}),
      ErrorCode.UNAUTHORIZED,
    );
    expect(getAuthParams).not.toHaveBeenCalled();
  });

  test("returns an allowlisted Stripe portal URL for the current user", async () => {
    const billingPortal = vi.fn(async () => ({
      data: { url: "https://billing.stripe.com/p/session/test_123" },
      error: null,
    }));
    vi.spyOn(Autumn.prototype, "getAuthParams").mockResolvedValue({
      autumn: { customers: { billingPortal } },
      identifierOpts: { customerId: "billing-user" },
    } as never);
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    await expect(
      t.action(api.billing.createBillingPortal, {
        returnUrl: "https://www.wrapper.sh/dashboard",
      }),
    ).resolves.toEqual({
      portalUrl: "https://billing.stripe.com/p/session/test_123",
    });
    expect(billingPortal).toHaveBeenCalledWith("billing-user", {
      return_url: "https://www.wrapper.sh/dashboard",
    });
  });

  test("rejects billing return URLs outside the configured app origin", async () => {
    const getAuthParams = vi.spyOn(Autumn.prototype, "getAuthParams");
    const t = convexTest(schema, modules).withIdentity({ subject: "billing-user" });

    await expectConvexError(
      () =>
        t.action(api.billing.createBillingPortal, {
          returnUrl: "https://attacker.example/dashboard",
        }),
      ErrorCode.INVALID_ARGUMENTS,
    );
    expect(getAuthParams).not.toHaveBeenCalled();
  });
});

describe("billing account cleanup", () => {
  test("queues provider work without contacting billing during account deletion", async () => {
    vi.useFakeTimers();
    try {
      const getAuthParams = vi.spyOn(Autumn.prototype, "getAuthParams");
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(queueBillingCustomerDeletionRef, { userId: "delete-user" }),
      ).resolves.toEqual({ queued: true });
      expect(getAuthParams).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  test("defers an outage with bounded metadata and no provider message leakage", async () => {
    vi.useFakeTimers();
    try {
      const secret = "sk_live_provider_echo";
      vi.spyOn(Autumn.prototype, "getAuthParams").mockResolvedValue({
        autumn: {
          customers: {
            delete: async () => ({
              data: null,
              error: { code: secret, message: `provider echoed ${secret}` },
              statusCode: 503,
            }),
          },
        },
        identifierOpts: { customerId: "delete-user" },
      } as never);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const t = convexTest(schema, modules);

      await expect(
        t.action(deleteBillingCustomerRef, { attempt: 1, userId: "delete-user" }),
      ).resolves.toEqual({
        alreadyAbsent: false,
        attempt: 1,
        retryScheduled: true,
        succeeded: false,
      });

      const serializedLogs = JSON.stringify(warn.mock.calls);
      expect(serializedLogs).toContain("http_503");
      expect(serializedLogs).not.toContain(secret);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
