import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// The issuance ceiling is 120 codes/minute; deleting up to 500 expired rows
// each minute drains both steady-state traffic and a bounded existing backlog.
crons.interval(
  "cleanup expired device codes",
  { minutes: 1 },
  internal.deviceAuth.cleanupExpiredDeviceCodes,
  {},
);

export default crons;
