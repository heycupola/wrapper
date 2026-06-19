import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
  openSync,
  closeSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createLogger } from "@repo/logger";
import type { SessionId } from "@repo/protocol";
import { paths } from "../util/paths";

const log = createLogger("registry");

/**
 * On-disk session registry.
 *
 * Every running `wrapper shell-host` writes a record into `sessions.json` so
 * other commands (`wrapper status`, `wrapper attach` without --port, the
 * future relay daemon) can discover what's alive.
 *
 * Storage rules:
 *   - JSON file at `paths.sessionsRegistry()`, mode 0600.
 *   - All writes are atomic: write a sibling tempfile, fsync-equivalent
 *     `writeFileSync` with mode 0600, then `renameSync` on top of the real
 *     file. This avoids torn reads if two shell-hosts race.
 *   - Reads are best-effort: a malformed file is treated as empty so a
 *     corrupted registry never crashes the rest of the CLI.
 *   - Stale entries (PID gone) are cleaned out lazily on every read.
 *
 * Concurrency note: we don't use a real file lock. Two simultaneous writers
 * could clobber each other's record. In practice each shell-host writes
 * once at startup and once at shutdown, so the contention window is tiny.
 * If this becomes a problem we'll add `proper-lockfile` later.
 */

export interface SessionRecord {
  /** Stable session id (from `createSessionId()`). */
  id: SessionId;
  /** OS process id of the shell-host. */
  pid: number;
  /** Local port the WS server is bound to. */
  port: number;
  /** Working directory at startup (for human-readable session lists). */
  cwd: string;
  /** Path of the wrapped shell. */
  shell: string;
  /** Optional human label, e.g. `"ghostty.tab.3"` if we can detect it. */
  label?: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Whether the session has opted in to relay forwarding. */
  shared: boolean;
}

interface RegistryFile {
  /** Bumped whenever the schema changes; readers tolerate older versions. */
  version: 1;
  sessions: SessionRecord[];
}

const SCHEMA_VERSION = 1;
const EMPTY: RegistryFile = { version: SCHEMA_VERSION, sessions: [] };

function readRaw(): RegistryFile {
  const file = paths.sessionsRegistry();
  if (!existsSync(file)) return clone(EMPTY);
  try {
    const text = readFileSync(file, "utf8");
    if (text.length === 0) return clone(EMPTY);
    const parsed = JSON.parse(text) as Partial<RegistryFile>;
    if (!parsed || typeof parsed !== "object") return clone(EMPTY);
    return {
      version: SCHEMA_VERSION,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (err) {
    log.warn("registry read failed; treating as empty", { error: (err as Error).message });
    return clone(EMPTY);
  }
}

function writeRaw(data: RegistryFile): void {
  const file = paths.sessionsRegistry();
  const tmp = join(dirname(file), `.sessions.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmp, file);
  } catch (err) {
    log.warn("registry write failed", { error: (err as Error).message });
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const LOCK_ACQUIRE_TIMEOUT_MS = 2000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 15;

/**
 * Serialize read-modify-write on the registry with an exclusive lock file so
 * two `shell-host` processes starting together can't clobber each other's
 * record. Best-effort: if the lock can't be acquired within the timeout (or a
 * stale lock is detected), we break/proceed so the CLI never deadlocks.
 */
function withRegistryLock<T>(fn: () => T): T {
  const lockFile = `${paths.sessionsRegistry()}.lock`;
  const start = Date.now();
  let fd: number | null = null;

  while (fd === null) {
    try {
      fd = openSync(lockFile, "wx", 0o600);
    } catch {
      try {
        const age = Date.now() - statSync(lockFile).mtimeMs;
        if (age > LOCK_STALE_MS) {
          unlinkSync(lockFile);
          continue;
        }
      } catch {
        // Lock vanished between open and stat; retry immediately.
        continue;
      }
      if (Date.now() - start > LOCK_ACQUIRE_TIMEOUT_MS) break;
      Bun.sleepSync(LOCK_RETRY_MS);
    }
  }

  try {
    return fn();
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
      try {
        unlinkSync(lockFile);
      } catch {
        // ignore
      }
    }
  }
}

function isPidAlive(pid: number): boolean {
  try {
    // Signal 0 is the standard "is this process reachable?" probe.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pruneStale(data: RegistryFile): { kept: RegistryFile; removed: SessionRecord[] } {
  const removed: SessionRecord[] = [];
  const kept = data.sessions.filter((s) => {
    if (isPidAlive(s.pid)) return true;
    removed.push(s);
    return false;
  });
  return { kept: { version: data.version, sessions: kept }, removed };
}

/**
 * List all live sessions, transparently dropping records whose PID is gone.
 * Rewrites the file when stale entries are pruned.
 */
export function listSessions(): SessionRecord[] {
  const raw = readRaw();
  const { kept, removed } = pruneStale(raw);
  if (removed.length > 0) {
    log.debug("registry pruned stale sessions", { count: removed.length });
    writeRaw(kept);
  }
  return clone(kept.sessions);
}

/** Find a session by id, or `null` if unknown / stale. */
export function findSession(id: SessionId): SessionRecord | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

/** Find a live session by its local port, or `null` if none matches. */
export function findSessionByPort(port: number): SessionRecord | null {
  return listSessions().find((s) => s.port === port) ?? null;
}

/** Most recently created live session (helper for `wrapper attach` w/o args). */
export function latestSession(): SessionRecord | null {
  const sessions = listSessions();
  if (sessions.length === 0) return null;
  return sessions.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as SessionRecord;
}

/** Insert a record. Replaces any existing entry with the same id. */
export function registerSession(record: SessionRecord): void {
  withRegistryLock(() => {
    const raw = readRaw();
    const others = raw.sessions.filter((s) => s.id !== record.id);
    others.push(record);
    writeRaw({ version: SCHEMA_VERSION, sessions: others });
  });
  log.debug("registry registered session", { id: record.id, pid: record.pid, port: record.port });
}

/** Remove a record by id. No-op if the record is already gone. */
export function unregisterSession(id: SessionId): void {
  withRegistryLock(() => {
    const raw = readRaw();
    const next = raw.sessions.filter((s) => s.id !== id);
    if (next.length === raw.sessions.length) return;
    writeRaw({ version: SCHEMA_VERSION, sessions: next });
  });
  log.debug("registry unregistered session", { id });
}

/** Mutate the `shared` flag of a record in place. */
export function setSessionShared(id: SessionId, shared: boolean): void {
  withRegistryLock(() => {
    const raw = readRaw();
    const next = raw.sessions.map((s) => (s.id === id ? { ...s, shared } : s));
    writeRaw({ version: SCHEMA_VERSION, sessions: next });
  });
}

/**
 * Touch the registry file at module load so callers can observe the path
 * even before the first session is registered. Failure is silent.
 */
try {
  closeSync(openSync(paths.sessionsRegistry(), "a", 0o600));
} catch {
  // ignore
}
