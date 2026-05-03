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
});
