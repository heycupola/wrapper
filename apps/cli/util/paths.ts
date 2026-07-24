import { homedir, platform } from "node:os";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "./env";

/**
 * Wrapper directory layout.
 *
 * On macOS and Linux we follow the XDG Base Directory Specification.
 * On Windows we fall back to `%APPDATA%\<namespace>\` so the same paths
 * still work under WSL or future native ports. Everywhere we namespace
 * by `env.namespace` (`wrapper` or `wrapper-dev`) so dev and prod can
 * coexist without ever colliding on disk.
 */

const HOME = homedir();
const PLATFORM = platform();

function xdg(envVar: string, fallback: string): string {
  const raw = process.env[envVar];
  return raw && raw.length > 0 ? raw : fallback;
}

function configRoot(): string {
  if (PLATFORM === "win32") {
    return resolve(HOME, "AppData", "Roaming");
  }
  return xdg("XDG_CONFIG_HOME", join(HOME, ".config"));
}

function stateRoot(): string {
  if (PLATFORM === "win32") {
    return resolve(HOME, "AppData", "Local");
  }
  return xdg("XDG_STATE_HOME", join(HOME, ".local", "state"));
}

function cacheRoot(): string {
  if (PLATFORM === "win32") {
    return resolve(HOME, "AppData", "Local", "Cache");
  }
  return xdg("XDG_CACHE_HOME", join(HOME, ".cache"));
}

const APP_STATE = join(stateRoot(), env.namespace);
const APP_CONFIG = join(configRoot(), env.namespace);
const APP_CACHE = join(cacheRoot(), env.namespace);

function ensureDir(dir: string): string {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {
    // already exists or read-only filesystem; let downstream calls surface it
  }
  return dir;
}

export const paths = {
  /** Runtime state, registry, logs. */
  state: (): string => ensureDir(APP_STATE),
  /** User config, auth tokens. */
  config: (): string => ensureDir(APP_CONFIG),
  /** Disposable artefacts. */
  cache: (): string => ensureDir(APP_CACHE),

  /** `${state}/sessions.json` */
  sessionsRegistry: (): string => join(paths.state(), "sessions.json"),
  /** `${state}/wrapper.log` */
  logFile: (): string => join(paths.state(), "wrapper.log"),
  /** `${config}/auth.json` */
  authFile: (): string => join(paths.config(), "auth.json"),
  /** `${config}/telemetry.json` */
  telemetryFile: (): string => join(paths.config(), "telemetry.json"),
} as const;

export const platformInfo = {
  isMac: PLATFORM === "darwin",
  isLinux: PLATFORM === "linux",
  isWindows: PLATFORM === "win32",
  raw: PLATFORM,
} as const;
