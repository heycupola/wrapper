/**
 * Signal handling helper.
 *
 * Wires SIGINT, SIGTERM, and SIGHUP to a single async cleanup function.
 * Cleanup is invoked at most once. Returns a `dispose()` to detach the
 * handlers (used when shutdown is initiated by other means, e.g. PTY exit).
 */

export type ShutdownReason = "SIGINT" | "SIGTERM" | "SIGHUP" | "exit";

export interface ShutdownOptions {
  /** Called once when any registered signal arrives (or `dispose()` is called via "exit"). */
  onShutdown: (reason: ShutdownReason) => void | Promise<void>;
}

export interface ShutdownHandle {
  /** Detach signal handlers. Idempotent. */
  dispose: () => void;
}

const SIGNALS: ReadonlyArray<ShutdownReason> = ["SIGINT", "SIGTERM", "SIGHUP"];

export function installShutdownHandlers(opts: ShutdownOptions): ShutdownHandle {
  let fired = false;
  const handlers = new Map<NodeJS.Signals, NodeJS.SignalsListener>();

  const fire = (reason: ShutdownReason): void => {
    if (fired) return;
    fired = true;
    detach();
    void Promise.resolve(opts.onShutdown(reason));
  };

  for (const sig of SIGNALS) {
    const handler: NodeJS.SignalsListener = () => fire(sig);
    handlers.set(sig, handler);
    process.once(sig, handler);
  }

  const detach = (): void => {
    for (const [sig, handler] of handlers) {
      process.off(sig, handler);
    }
    handlers.clear();
  };

  return { dispose: detach };
}
