import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  onboarding: defineTable({
    userId: v.string(),
    completedProfile: v.boolean(),
    connectedCli: v.boolean(),
    sharedFirstSession: v.boolean(),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    source: v.optional(v.string()),
    sourceOther: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),
  hostSession: defineTable({
    sessionId: v.string(),
    ownerUserId: v.string(),
    shell: v.string(),
    cwd: v.string(),
    port: v.optional(v.number()),
    hostPid: v.optional(v.number()),
    shared: v.boolean(),
    // SHA-256 of the normalized share code. Set when the owner shares; a viewer
    // that is not the owner must present the matching code to get a viewer ticket.
    shareCodeHash: v.optional(v.string()),
    relayState: v.union(
      v.literal("offline"),
      v.literal("connecting"),
      v.literal("online"),
      v.literal("error"),
    ),
    relayLastChangedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("closed")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastHeartbeatAt: v.number(),
    closedAt: v.optional(v.number()),
    closeReason: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_owner", ["ownerUserId"])
    .index("by_owner_status", ["ownerUserId", "status"])
    .index("by_owner_updatedAt", ["ownerUserId", "updatedAt"]),
  relayTicket: defineTable({
    tokenHash: v.string(),
    sessionId: v.string(),
    role: v.union(v.literal("host"), v.literal("viewer")),
    userId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"])
    .index("by_session_role", ["sessionId", "role"])
    .index("by_expiresAt", ["expiresAt"]),
  rateLimit: defineTable({
    key: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_key", ["key"]),
  appleAccountEvent: defineTable({
    eventIdHash: v.string(),
    subjectHash: v.string(),
    eventType: v.string(),
    status: v.union(v.literal("pending"), v.literal("processed")),
    disposition: v.optional(
      v.union(
        v.literal("ignored"),
        v.literal("account_not_found"),
        v.literal("invalidate_apple"),
        v.literal("unlink_apple"),
        v.literal("delete_user"),
      ),
    ),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_event_id", ["eventIdHash"])
    .index("by_created_at", ["createdAt"]),
  emailState: defineTable({
    userId: v.string(),
    hasPro: v.optional(v.boolean()),
    planDowngradedAt: v.optional(v.number()),
    gracePeriodEmailSent: v.optional(v.boolean()),
    planUpgradedEmailSent: v.optional(v.boolean()),
    accessRestrictedEmailSent: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_plan_downgraded", ["planDowngradedAt"]),
  processedWebhook: defineTable({
    eventId: v.string(),
    source: v.union(v.literal("autumn"), v.literal("resend")),
    processedAt: v.number(),
  })
    .index("by_eventId_source", ["eventId", "source"])
    .index("by_processedAt", ["processedAt"]),
});
