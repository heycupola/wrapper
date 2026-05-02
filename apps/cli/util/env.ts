/**
 * Wrapper runtime environment.
 *
 * Two boolean toggles, read once at module load:
 *
 *   - `DEV=true`  → development mode (relic-style convention).
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
 *     DEV=true bun run index.ts shell-host
 *
 * The `dev` script in `apps/cli/package.json` already sets it.
 *
 * The convention deliberately matches Relic's CLI so an engineer who has
 * worked on either project sees the same environment knobs.
 */

const RAW_DEV = (process.env.DEV ?? "").toLowerCase();
const IS_DEV = RAW_DEV === "true";
const IS_CI = process.env.CI !== undefined && process.env.CI !== "";

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
  /** Auth callback origin used by the future Better Auth flow. */
  authOrigin:
    process.env.WRAPPER_AUTH_ORIGIN ?? (IS_DEV ? "http://localhost:3000" : "https://wrapper.sh"),
} as const;
