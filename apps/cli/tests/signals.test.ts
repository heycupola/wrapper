import { describe, expect, test } from "bun:test";
import { installShutdownHandlers } from "../util/signals";

const SIGNAL_NAMES = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

function listenerCounts(): Record<(typeof SIGNAL_NAMES)[number], number> {
  return {
    SIGINT: process.listenerCount("SIGINT"),
    SIGTERM: process.listenerCount("SIGTERM"),
    SIGHUP: process.listenerCount("SIGHUP"),
  };
}

describe("installShutdownHandlers", () => {
  test("dispose removes signal listeners without throwing", () => {
    const before = listenerCounts();
    const handle = installShutdownHandlers({
      onShutdown: () => {},
    });

    for (const sig of SIGNAL_NAMES) {
      expect(process.listenerCount(sig)).toBe(before[sig] + 1);
    }

    expect(() => handle.dispose()).not.toThrow();

    for (const sig of SIGNAL_NAMES) {
      expect(process.listenerCount(sig)).toBe(before[sig]);
    }
  });

  test("dispose is idempotent", () => {
    const handle = installShutdownHandlers({
      onShutdown: () => {},
    });
    handle.dispose();
    expect(() => handle.dispose()).not.toThrow();
  });
});
