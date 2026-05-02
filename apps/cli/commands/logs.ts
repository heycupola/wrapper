import { existsSync, statSync, openSync, readSync, closeSync, watch } from "node:fs";
import { getLogsDir } from "@repo/logger";
import { join } from "node:path";
import { env } from "../util/env";

function activeLogFile(): string {
  if (process.env.WRAPPER_LOG_FILE && process.env.WRAPPER_LOG_FILE.length > 0) {
    return process.env.WRAPPER_LOG_FILE;
  }
  return join(getLogsDir(), env.isDev ? "debug.log" : "wrapper.log");
}

/**
 * `wrapper logs` — tail Wrapper's log file.
 *
 * Behaviour:
 *   - Default: print the last `--tail N` lines (default 200) and exit.
 *   - `--follow / -f`: also watch for appended bytes and stream them.
 *
 * We don't shell out to `tail` so the command works the same on every
 * platform (notably without GNU tail's `-F`).
 */

export interface LogsOptions {
  tail?: number;
  follow?: boolean;
}

const DEFAULT_TAIL = 200;
const READ_CHUNK = 64 * 1024;

export async function runLogs(opts: LogsOptions): Promise<void> {
  const file = activeLogFile();
  if (!existsSync(file)) {
    process.stderr.write(`[wrapper] no log file yet at ${file}\n`);
    process.exit(0);
  }

  const tail = Math.max(0, opts.tail ?? DEFAULT_TAIL);
  const initialEnd = readLastLines(file, tail);
  if (initialEnd.text.length > 0) process.stdout.write(initialEnd.text);

  if (!opts.follow) return;

  // Follow mode: poll-watch the file and emit new bytes as they appear.
  let cursor = initialEnd.end;
  const watcher = watch(file, () => {
    const stat = statSync(file);
    if (stat.size < cursor) {
      // truncation/rotation — restart from 0
      cursor = 0;
    }
    if (stat.size === cursor) return;
    const fd = openSync(file, "r");
    try {
      const buffer = Buffer.alloc(stat.size - cursor);
      readSync(fd, buffer, 0, buffer.length, cursor);
      process.stdout.write(buffer.toString("utf8"));
      cursor = stat.size;
    } finally {
      closeSync(fd);
    }
  });

  process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });

  // Hold the event loop open.
  await new Promise<void>(() => undefined);
}

interface TailResult {
  text: string;
  end: number;
}

function readLastLines(file: string, lines: number): TailResult {
  const stat = statSync(file);
  if (stat.size === 0 || lines === 0) return { text: "", end: stat.size };

  const fd = openSync(file, "r");
  try {
    let position = stat.size;
    let collected = "";
    let newlines = 0;

    while (position > 0 && newlines <= lines) {
      const readSize = Math.min(READ_CHUNK, position);
      position -= readSize;
      const buffer = Buffer.alloc(readSize);
      readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString("utf8");
      collected = chunk + collected;
      newlines += countNewlines(chunk);
    }

    if (newlines <= lines) return { text: collected, end: stat.size };

    // We have at least `lines+1` newlines somewhere in `collected`. Drop
    // everything before the first newline that puts us past `lines`.
    let cut = 0;
    let seen = 0;
    for (let i = collected.length - 1; i >= 0; i -= 1) {
      if (collected.charCodeAt(i) === 0x0a /* \n */) {
        seen += 1;
        if (seen === lines + 1) {
          cut = i + 1;
          break;
        }
      }
    }
    return { text: collected.slice(cut), end: stat.size };
  } finally {
    closeSync(fd);
  }
}

function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 0x0a) n += 1;
  return n;
}
