import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Logger configuration.
 *
 * The package is intentionally self-contained — it does not import any
 * other workspace package — so it can move out of this repository unchanged
 * the moment we're ready to publish it as a standalone Cupola package.
 *
 * Environment knobs:
 *
 *   NODE_ENV=development     isolated development mode
 *   NODE_ENV=test            isolated test mode
 *                            (any other value, including unset, is production)
 *   CI                       any value flips CI mode (telemetry off,
 *                            console mirror off)
 *   WRAPPER_LOG              "debug" | "info" | "warn" | "error" | "off"
 *   WRAPPER_LOG_FILE         override the log file path
 *   WRAPPER_TELEMETRY        "false" disables telemetry
 *   WRAPPER_POSTHOG_KEY      PostHog project key (empty disables telemetry)
 *   WRAPPER_TELEMETRY_URL    override the proxy host
 */

const HOME = process.env.HOME || process.env.USERPROFILE || "~";
const NODE_ENV = (process.env.NODE_ENV ?? "").toLowerCase();
const IS_DEV = NODE_ENV === "development" || NODE_ENV === "test";
const IS_CI = process.env.CI !== undefined && process.env.CI !== "";
const NS = IS_DEV ? "wrapper-dev" : "wrapper";

const PLATFORM = platform();

function configRoot(): string {
  if (PLATFORM === "win32") return resolve(HOME, "AppData", "Roaming");
  return process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
    ? process.env.XDG_CONFIG_HOME
    : join(homedir(), ".config");
}

function stateRoot(): string {
  if (PLATFORM === "win32") return resolve(HOME, "AppData", "Local");
  return process.env.XDG_STATE_HOME && process.env.XDG_STATE_HOME.length > 0
    ? process.env.XDG_STATE_HOME
    : join(homedir(), ".local", "state");
}

const CONFIG_DIR = join(configRoot(), NS);
const STATE_DIR = join(stateRoot(), NS);
const LOGS_DIR = join(STATE_DIR, "logs");
const TELEMETRY_FILE = join(CONFIG_DIR, "telemetry.json");

const DEFAULT_DEV_LOG = join(LOGS_DIR, "debug.log");
const DEFAULT_PROD_LOG = join(LOGS_DIR, "wrapper.log");

export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

export interface LoggerConfig {
  level: LogLevel;
  logFile: string;
  isDev: boolean;
  isCI: boolean;
  telemetryEnabled: boolean;
  telemetryProxyUrl: string;
  posthogApiKey: string;
}

function parseLevel(): LogLevel {
  const v = process.env.WRAPPER_LOG?.toLowerCase();
  if (v && ["debug", "info", "warn", "error", "off"].includes(v)) return v as LogLevel;
  return IS_DEV ? "info" : "warn";
}

function readTelemetryPreference(): boolean | null {
  try {
    if (!existsSync(TELEMETRY_FILE)) return null;
    const data = JSON.parse(readFileSync(TELEMETRY_FILE, "utf-8"));
    return typeof data.enabled === "boolean" ? data.enabled : null;
  } catch {
    return null;
  }
}

function isTelemetryEnabled(): boolean {
  if (process.env.WRAPPER_TELEMETRY === "false") return false;
  if (IS_CI) return false;
  if (IS_DEV) return false;
  const preference = readTelemetryPreference();
  if (preference !== null) return preference;
  // No recorded consent yet. Many users first launch via the rc `shell-host`
  // hook, which never shows the opt-out banner, so default to OFF until an
  // explicit preference is saved.
  return false;
}

export function getConfig(): LoggerConfig {
  return {
    level: parseLevel(),
    logFile:
      process.env.WRAPPER_LOG_FILE && process.env.WRAPPER_LOG_FILE.length > 0
        ? process.env.WRAPPER_LOG_FILE
        : IS_DEV
          ? DEFAULT_DEV_LOG
          : DEFAULT_PROD_LOG,
    isDev: IS_DEV,
    isCI: IS_CI,
    telemetryEnabled: isTelemetryEnabled(),
    telemetryProxyUrl: process.env.WRAPPER_TELEMETRY_URL ?? "https://telemetry.wrapper.sh",
    posthogApiKey: process.env.WRAPPER_POSTHOG_KEY ?? "",
  };
}

export function ensureLogDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function saveTelemetryPreference(enabled: boolean): void {
  try {
    const dir = dirname(TELEMETRY_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(TELEMETRY_FILE, JSON.stringify({ enabled }, null, 2), { mode: 0o600 });
  } catch {
    // best-effort
  }
}

export function getTelemetryPreference(): boolean | null {
  return readTelemetryPreference();
}

export function isFirstRun(): boolean {
  return readTelemetryPreference() === null;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getLogsDir(): string {
  return LOGS_DIR;
}
