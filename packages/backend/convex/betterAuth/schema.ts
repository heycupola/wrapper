import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

const schema = defineSchema({
  ...tables,
  user: tables.user.index("by_email", ["email"]),
  deviceCode: tables.deviceCode
    .index("by_deviceCode", ["deviceCode"])
    .index("by_userCode", ["userCode"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),
  verification: tables.verification.index("by_value", ["value"]),
});

export default schema;
