import { trackEvent } from "@repo/logger";
import { listSessions } from "../registry/sessions";
import { env } from "../util/env";
import { paths } from "../util/paths";

/**
 * `wrapper status` — print all live sessions in a tiny human table.
 *
 * Stays minimal on purpose: no `--json` flag yet, no colour, no spinner.
 * Anyone scripting around this should read the registry file directly.
 */

export async function runStatus(): Promise<void> {
  const sessions = listSessions();
  trackEvent("status_executed", { sessionCount: sessions.length });

  if (sessions.length === 0) {
    process.stdout.write(
      `No live wrapper sessions (${env.label} environment).\n` +
        `Registry: ${paths.sessionsRegistry()}\n`,
    );
    return;
  }

  const rows = sessions.map((s) => ({
    id: s.id,
    pid: String(s.pid),
    port: String(s.port),
    shared: s.shared ? "yes" : "no",
    shell: shortShell(s.shell),
    cwd: shortenHome(s.cwd),
    started: relativeTime(s.createdAt),
  }));

  const headers = ["ID", "PID", "PORT", "SHARED", "SHELL", "CWD", "STARTED"] as const;
  type Column = (typeof headers)[number];

  const cells = rows.map((r) => [r.id, r.pid, r.port, r.shared, r.shell, r.cwd, r.started]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((row) => row[i]?.length ?? 0)),
  );

  const renderRow = (row: readonly string[]): string =>
    row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  ");

  process.stdout.write(`${renderRow(headers as readonly Column[])}\n`);
  process.stdout.write(`${widths.map((w) => "─".repeat(w)).join("  ")}\n`);
  for (const row of cells) {
    process.stdout.write(`${renderRow(row)}\n`);
  }
  process.stdout.write(`\nEnvironment: ${env.label}\n`);
}

function shortShell(path: string): string {
  return path.split("/").pop() ?? path;
}

function shortenHome(path: string): string {
  const home = process.env.HOME;
  if (!home) return path;
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
