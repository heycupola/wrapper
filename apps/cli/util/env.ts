/**
 * Wrapper runtime environment.
 *
 * Two boolean toggles, read once at module load:
 *
 *   - `NODE_ENV`  → set to `production` for production mode.
 *                   Any other value (or unset) is treated as development.
 *                   Switches every server URL to localhost, namespaces all
 *                   on-disk paths under `wrapper-dev`, mirrors logs to
 *                   stderr, and disables telemetry.
 *
 *   - `CI`        → any non-empty value flips the CI flag.
 *                   Disables telemetry and console output the same way
 *                   most popular CLI tools do.
 *
 * Always switch via the env var, never via code:
 *
 *     NODE_ENV=development bun run index.ts shell-host
 *
 * The `dev` script in `apps/cli/package.json` already sets it.
 *
 * The convention deliberately matches Relic's CLI so an engineer who has
 * worked on either project sees the same environment knobs.
 */

const NODE_ENV = (process.env.NODE_ENV ?? "").toLowerCase();
const IS_DEV = NODE_ENV !== "production";
const IS_CI = process.env.CI !== undefined && process.env.CI !== "";
const HUD = (process.env.WRAPPER_HUD ?? "").toLowerCase();
const HUD_ENABLED = HUD !== "0" && HUD !== "false" && HUD !== "off";
const P2P = (process.env.WRAPPER_P2P ?? "").toLowerCase();
const P2P_ENABLED = P2P === "1" || P2P === "true" || P2P === "on";

export const env = {
  /** Development mode toggle. */
  isDev: IS_DEV,
  /** Production mode (everything that is not dev). */
  isProd: !IS_DEV,
  /** CI/CD mode. Independent of dev — both can be true at once. */
  isCI: IS_CI,
  /** Short human label, useful for log lines and prompt headers. */
  label: IS_DEV ? "dev" : "prod",
  /**
   * App namespace used to scope on-disk paths and Keychain service names.
   * Anything user-visible should treat dev and prod as separate apps.
   */
  namespace: IS_DEV ? "wrapper-dev" : "wrapper",
  /** Relay endpoint (real values land with the relay package). */
  relayUrl:
    process.env.WRAPPER_RELAY_URL ?? (IS_DEV ? "ws://localhost:8080" : "wss://relay.wrapper.sh"),
  /** Auth callback origin used by the Better Auth device login flow. */
  authOrigin:
    process.env.WRAPPER_AUTH_ORIGIN ?? (IS_DEV ? "http://localhost:3000" : "https://wrapper.sh"),
  /** CLI HUD toggle: on by default, set WRAPPER_HUD=off to disable. */
  hudEnabled: HUD_ENABLED,
  /**
   * Opt-in WebRTC P2P fast path (WRAPPER_P2P=1). Off by default: the relay
   * WebSocket remains the transport. When on, host/viewer try a direct data
   * channel and fall back to the relay if it can't be established.
   */
  p2pEnabled: P2P_ENABLED,
} as const;
