import { trackEvent } from "@repo/logger";
import pc from "picocolors";
import { listSessions } from "../registry/sessions";
import { env } from "../util/env";
import { paths } from "../util/paths";
import { command, heading, kv } from "../util/ui";

/**
 * `wrapper status` — print all live sessions in a small human table.
 *
 * Stays minimal on purpose: no `--json` flag yet. Anyone scripting around
 * this should read the registry file directly. Colour is decorative only;
 * the plain text is still column aligned when piped.
 */

function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

export async function runStatus(): Promise<void> {
  const sessions = listSessions();
  trackEvent("status_executed", { sessionCount: sessions.length });

  out(heading("status", env.label));
  out();

  if (sessions.length === 0) {
    out(`  ${pc.dim("No live sessions.")}`);
    out();
    out(`  ${kv("Start one", command("wrapper share"))}`);
    out(`  ${kv("Registry", pc.dim(shortenHome(paths.sessionsRegistry())))}`);
    out();
    return;
  }

  const headers = ["", "ID", "PID", "PORT", "SHELL", "CWD", "STARTED"] as const;
  const cells = sessions.map((s) => [
    s.shared ? "●" : "○",
    s.id,
    String(s.pid),
    String(s.port),
    shortShell(s.shell),
    shortenHome(s.cwd),
    relativeTime(s.createdAt),
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((row) => row[i]?.length ?? 0)),
  );

  const renderRow = (row: readonly string[], paint: (cell: string, i: number) => string): string =>
    `  ${row.map((cell, i) => paint(cell.padEnd(widths[i] ?? 0), i)).join("  ")}`;

  out(renderRow(headers, (cell) => pc.dim(cell)));
  for (const [index, row] of cells.entries()) {
    const shared = sessions[index]?.shared ?? false;
    out(
      renderRow(row, (cell, i) => {
        if (i === 0) return shared ? pc.green(cell) : pc.dim(cell);
        if (i === 1) return pc.cyan(cell);
        if (i === 6) return pc.dim(cell);
        return cell;
      }),
    );
  }

  const sharedCount = sessions.filter((s) => s.shared).length;
  out();
  out(
    `  ${pc.green("●")} ${pc.dim("shared")}  ${pc.dim("○ local")}  ${pc.dim("·")}  ${pc.dim(
      `${sessions.length} session${sessions.length === 1 ? "" : "s"}, ${sharedCount} shared`,
    )}`,
  );
  out(`  ${pc.dim("Local sessions listen on 127.0.0.1. Cloud sync happens only while shared.")}`);
  out();
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
