import { describe, expect, test } from "bun:test";
import { getSessionTimeoutConfig, shouldMarkSessionStale } from "../convex/lib/sessionConfig";

describe("session timeout config", () => {
  test("uses defaults when env is missing", () => {
    const config = getSessionTimeoutConfig({});
    expect(config.staleAfterMs).toBe(300_000);
    expect(config.staleGraceMs).toBe(30_000);
    expect(config.staleScheduleDelayMs).toBe(330_000);
  });

  test("uses custom env values", () => {
    const config = getSessionTimeoutConfig({
      WRAPPER_SESSION_STALE_AFTER_MS: "120000",
      WRAPPER_SESSION_STALE_GRACE_MS: "5000",
    });
    expect(config.staleAfterMs).toBe(120_000);
    expect(config.staleGraceMs).toBe(5_000);
    expect(config.staleScheduleDelayMs).toBe(125_000);
  });

  test("falls back when env values are invalid", () => {
    const config = getSessionTimeoutConfig({
      WRAPPER_SESSION_STALE_AFTER_MS: "-1",
      WRAPPER_SESSION_STALE_GRACE_MS: "abc",
    });
    expect(config.staleAfterMs).toBe(300_000);
    expect(config.staleGraceMs).toBe(30_000);
    expect(config.staleScheduleDelayMs).toBe(330_000);
  });
});

describe("shouldMarkSessionStale", () => {
  test("returns true for active session with matching heartbeat", () => {
    expect(
      shouldMarkSessionStale({
        status: "active",
        lastHeartbeatAt: 1000,
        expectedLastHeartbeatAt: 1000,
      }),
    ).toBe(true);
  });

  test("returns false for closed session", () => {
    expect(
      shouldMarkSessionStale({
        status: "closed",
        lastHeartbeatAt: 1000,
        expectedLastHeartbeatAt: 1000,
      }),
    ).toBe(false);
  });

  test("returns false when heartbeat is newer than expected", () => {
    expect(
      shouldMarkSessionStale({
        status: "active",
        lastHeartbeatAt: 2000,
        expectedLastHeartbeatAt: 1000,
      }),
    ).toBe(false);
  });
});
