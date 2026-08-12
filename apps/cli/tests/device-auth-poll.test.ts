import { describe, expect, test } from "bun:test";
import {
  DeviceAuthPollingCancelledError,
  normalizeDeviceAuthErrorMessage,
  pollForDeviceToken,
} from "../util/device-auth-poll";

function makeClock() {
  let timestamp = 0;
  const delays: number[] = [];

  return {
    delays,
    now: () => timestamp,
    sleep: async (milliseconds: number) => {
      delays.push(milliseconds);
      timestamp += milliseconds;
    },
  };
}

describe("device auth polling", () => {
  test("waits sequentially, tolerates pending, and backs off on slow_down", async () => {
    const clock = makeClock();
    let attempts = 0;

    const token = await pollForDeviceToken({
      expiresInSeconds: 30,
      intervalSeconds: 2,
      now: clock.now,
      sleep: clock.sleep,
      poll: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("ConvexError: authorization_pending");
        if (attempts === 2) throw new Error("slow_down");
        return { sessionToken: "approved-token" };
      },
    });

    expect(token).toEqual({ sessionToken: "approved-token" });
    expect(clock.delays).toEqual([2_000, 2_000, 3_000]);
  });

  test("normalizes known codes embedded in transport errors", () => {
    expect(normalizeDeviceAuthErrorMessage(new Error("Server Error: access_denied (403)"))).toBe(
      "access_denied",
    );
    expect(normalizeDeviceAuthErrorMessage("request failed: expired_token")).toBe("expired_token");
    expect(normalizeDeviceAuthErrorMessage({ code: "slow_down" })).toBe("unknown_error");
  });

  test("turns terminal server responses into actionable errors", async () => {
    const cases = [
      ["access_denied", "Device authorization was denied."],
      ["expired_token", "Device code expired. Run `wrapper auth login` again."],
      ["invalid_request", "Token polling failed: invalid_request"],
    ] as const;

    for (const [code, message] of cases) {
      const clock = makeClock();
      // Each case owns its fake clock, so run them sequentially for clear failures.
      // eslint-disable-next-line no-await-in-loop
      await expect(
        pollForDeviceToken({
          expiresInSeconds: 30,
          intervalSeconds: 1,
          now: clock.now,
          sleep: clock.sleep,
          poll: async () => {
            throw new Error(code);
          },
        }),
      ).rejects.toThrow(message);
    }
  });

  test("does not poll after the device code expires", async () => {
    const clock = makeClock();
    let polls = 0;

    await expect(
      pollForDeviceToken({
        expiresInSeconds: 2,
        intervalSeconds: 2,
        now: clock.now,
        sleep: clock.sleep,
        poll: async () => {
          polls += 1;
          return "unexpected";
        },
      }),
    ).rejects.toThrow("Device authorization timed out");

    expect(polls).toBe(0);
    expect(clock.delays).toEqual([2_000]);
  });

  test("stops before polling when cancellation arrives during a wait", async () => {
    const clock = makeClock();
    let cancelled = false;
    let polls = 0;

    await expect(
      pollForDeviceToken({
        expiresInSeconds: 30,
        intervalSeconds: 1,
        isCancelled: () => cancelled,
        now: clock.now,
        sleep: async (milliseconds) => {
          await clock.sleep(milliseconds);
          cancelled = true;
        },
        poll: async () => {
          polls += 1;
          return "unexpected";
        },
      }),
    ).rejects.toBeInstanceOf(DeviceAuthPollingCancelledError);

    expect(polls).toBe(0);
  });
});
