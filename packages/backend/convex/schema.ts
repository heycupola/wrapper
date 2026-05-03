import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  hostSession: defineTable({
    sessionId: v.string(),
    ownerUserId: v.string(),
    shell: v.string(),
    cwd: v.string(),
    port: v.optional(v.number()),
    hostPid: v.optional(v.number()),
    shared: v.boolean(),
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
    .index("by_session_role", ["sessionId", "role"])
    .index("by_expiresAt", ["expiresAt"]),
});
