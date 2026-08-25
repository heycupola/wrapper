import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { createLogger } from "./lib/logger.ts";

const log = createLogger("autumnWebhook");

function getProPlanId(): string {
  const value = process.env.WRAPPER_AUTUMN_PRO_PLAN_ID;
  if (!value) return "pro";
  return value.trim();
}

type AutumnScenario =
  | "new"
  | "upgrade"
  | "downgrade"
  | "renew"
  | "cancel"
  | "expired"
  | "past_due"
  | "scheduled";

export type AutumnWebhookEvent = {
  type: string;
  data?: {
    scenario?: AutumnScenario;
    customer?: {
      id?: string;
      name?: string;
      email?: string;
    };
    updated_product?: {
      id?: string;
      name?: string;
    };
  };
};

type WebhookContext = {
  scheduler: Pick<ActionCtx["scheduler"], "runAfter">;
};

function isValidUserId(userId: string): boolean {
  return typeof userId === "string" && userId.length > 0 && userId.length < 100;
}

export async function handleAutumnWebhookEvent(ctx: WebhookContext, event: AutumnWebhookEvent) {
  if (event.type !== "customer.products.updated") {
    log.info("Unhandled event type", { type: event.type });
    return;
  }

  const scenario = event.data?.scenario;
  const productId = event.data?.updated_product?.id;

  if (productId !== getProPlanId()) {
    log.info("Ignoring non-Pro product update", { productId, scenario });
    return;
  }

  const userId = event.data?.customer?.id;

  if (!userId || !isValidUserId(userId)) {
    throw new Error("Autumn webhook is missing a valid customer ID");
  }

  switch (scenario) {
    case "new":
    case "upgrade": {
      log.info("Upgrading user to Pro from Autumn event", { userId, scenario });
      await ctx.scheduler.runAfter(0, internal.user._handlePlanUpgrade, { userId });
      break;
    }

    case "downgrade":
    case "cancel":
    case "expired":
    case "past_due": {
      log.info("Downgrading user to Free from Autumn event", { userId, scenario });
      await ctx.scheduler.runAfter(0, internal.user._handlePlanDowngrade, { userId });
      break;
    }

    case "scheduled":
    case "renew": {
      log.info("No local plan change needed for Autumn scenario", { userId, scenario });
      break;
    }

    default: {
      log.info("Unhandled Autumn product scenario", { userId, scenario });
    }
  }
}
