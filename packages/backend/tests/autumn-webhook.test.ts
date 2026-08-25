import { afterEach, describe, expect, test } from "bun:test";
import { handleAutumnWebhookEvent } from "../convex/autumnWebhook";

const originalPlanId = process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;

afterEach(() => {
  if (originalPlanId === undefined) {
    delete process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
  } else {
    process.env.WRAPPER_AUTUMN_PRO_PLAN_ID = originalPlanId;
  }
});

describe("handleAutumnWebhookEvent", () => {
  test("schedules upgrade and downgrade for the Pro product", async () => {
    process.env.WRAPPER_AUTUMN_PRO_PLAN_ID = "pro";
    const scheduled: Array<{ args: { userId: string } }> = [];
    const ctx = {
      scheduler: {
        runAfter: async (_ms: number, _ref: unknown, args: { userId: string }) => {
          scheduled.push({ args });
        },
      },
    } as unknown as Parameters<typeof handleAutumnWebhookEvent>[0];

    await handleAutumnWebhookEvent(ctx, {
      type: "customer.products.updated",
      data: {
        scenario: "upgrade",
        customer: { id: "user_upgrade" },
        updated_product: { id: "pro" },
      },
    });
    await handleAutumnWebhookEvent(ctx, {
      type: "customer.products.updated",
      data: {
        scenario: "cancel",
        customer: { id: "user_downgrade" },
        updated_product: { id: "pro" },
      },
    });
    await handleAutumnWebhookEvent(ctx, {
      type: "customer.products.updated",
      data: {
        scenario: "upgrade",
        customer: { id: "user_other" },
        updated_product: { id: "other_plan" },
      },
    });
    await handleAutumnWebhookEvent(ctx, {
      type: "customer.balance.updated",
      data: {
        scenario: "upgrade",
        customer: { id: "user_ignored" },
        updated_product: { id: "pro" },
      },
    });

    expect(scheduled.map((entry) => entry.args.userId)).toEqual(["user_upgrade", "user_downgrade"]);
  });

  test("rejects a missing customer id", async () => {
    process.env.WRAPPER_AUTUMN_PRO_PLAN_ID = "pro";
    const ctx = {
      scheduler: {
        runAfter: async () => {
          throw new Error("should not schedule");
        },
      },
    } as unknown as Parameters<typeof handleAutumnWebhookEvent>[0];

    await expect(
      handleAutumnWebhookEvent(ctx, {
        type: "customer.products.updated",
        data: {
          scenario: "new",
          updated_product: { id: "pro" },
        },
      }),
    ).rejects.toThrow("Autumn webhook is missing a valid customer ID");
  });
});
