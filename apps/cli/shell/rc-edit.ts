import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type { SupportedShell } from "./detect";
import { env } from "../util/env";

/**
 * Idempotent rc-file editor.
 *
 * We mark our patch with stable header / footer markers so we can recognise
 * and remove our own block on subsequent runs. The block contains a single
 * source/eval line that pulls the current `wrapper init <shell>` output —
 * never a copy of the wrapping logic itself, so users don't have to re-run
 * `wrapper install` after every CLI upgrade.
 */

const MARKER_BEGIN = "# >>> wrapper init >>>";
const MARKER_END = "# <<< wrapper init <<<";
const MARKER_PREAMBLE = "# Managed by `wrapper install`. Do not edit manually.";

export type PatchOutcome = "added" | "already-present" | "updated";

export interface PatchResult {
  outcome: PatchOutcome;
  rcFile: string;
  backup: string | null;
}

/**
 * Insert the wrapper hook into the user's rc file, making a one-time backup
 * the first time we touch it. The patch is idempotent: if the markers are
 * already present, we either no-op (`already-present`) or refresh the body
 * if it has drifted (`updated`).
 */
export function patchRc(shell: SupportedShell, rcFile: string): PatchResult {
  ensureFileDir(rcFile);
  const existing = existsSync(rcFile) ? readFileSync(rcFile, "utf8") : "";
  const block = renderBlock(shell);

  const backup =
    existing.length > 0 && !existing.includes(MARKER_BEGIN) ? makeBackup(rcFile) : null;

  if (!existing.includes(MARKER_BEGIN)) {
    const next =
      (existing.endsWith("\n") || existing.length === 0 ? existing : `${existing}\n`) +
      `\n${block}\n`;
    writeFileSync(rcFile, next, { mode: 0o644 });
    return { outcome: "added", rcFile, backup };
  }

  const replaced = replaceBlock(existing, block);
  if (replaced === existing) {
    return { outcome: "already-present", rcFile, backup: null };
  }
  writeFileSync(rcFile, replaced, { mode: 0o644 });
  return { outcome: "updated", rcFile, backup };
}

/**
 * Remove our managed block. Returns `false` if no block was found.
 */
export function unpatchRc(rcFile: string): boolean {
  if (!existsSync(rcFile)) return false;
  const existing = readFileSync(rcFile, "utf8");
  if (!existing.includes(MARKER_BEGIN)) return false;
  const stripped = stripBlock(existing);
  writeFileSync(rcFile, stripped, { mode: 0o644 });
  return true;
}

function renderBlock(shell: SupportedShell): string {
  const initLine = renderInitLine(shell);
  return [MARKER_BEGIN, MARKER_PREAMBLE, initLine, MARKER_END].join("\n");
}

function renderInitLine(shell: SupportedShell): string {
  const cmd = env.isDev ? `DEV=true wrapper init ${shell}` : `wrapper init ${shell}`;
  if (shell === "fish") return `${cmd} | source`;
  return `eval "$(${cmd})"`;
}

function replaceBlock(input: string, block: string): string {
  const re = blockRegex();
  return input.replace(re, block);
}

function stripBlock(input: string): string {
  const re = blockRegex();
  return (
    input
      .replace(re, "")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

function blockRegex(): RegExp {
  return new RegExp(`${escape(MARKER_BEGIN)}[\\s\\S]*?${escape(MARKER_END)}`, "m");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeBackup(rcFile: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${rcFile}.wrapper-backup-${stamp}`;
  copyFileSync(rcFile, backup);
  return backup;
}

function ensureFileDir(file: string): void {
  const dir = dirname(file);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}
