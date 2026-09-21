/**
 * Wrapper's terminal brand kit.
 *
 * One place for the wordmark, the `◆ wrapper` tag, and the small set of
 * line-level helpers every command uses. Colours come from picocolors, which
 * already respects NO_COLOR, FORCE_COLOR, and non-TTY pipes, so the output is
 * safe to `grep` and to read in CI logs.
 */

import pc from "picocolors";

export const TAGLINE = "Bring your terminal to your phone, on demand.";

/**
 * Figlet-style lowercase wordmark. Kept as plain rows (no template literal)
 * so the backslashes and the backtick in row 1 survive formatting.
 */
export const WORDMARK_ROWS: readonly string[] = [
  "__      __ _ __   __ _  _ __   _ __    ___  _ __ ",
  "\\ \\ /\\ / /| '__| / _` || '_ \\ | '_ \\  / _ \\| '__|",
  " \\ V  V / | |   | (_| || |_) || |_) ||  __/| |   ",
  "  \\_/\\_/  |_|    \\__,_|| .__/ | .__/  \\___||_|   ",
  "                       |_|    |_|                ",
];

const GRADIENT = [pc.cyanBright, pc.cyan, pc.blueBright, pc.blue, pc.magenta] as const;

/** The wordmark with a vertical cyan → magenta gradient. */
export function renderWordmark(indent = "  "): string {
  return WORDMARK_ROWS.map((row, index) => {
    const paint = GRADIENT[index] ?? pc.cyan;
    return `${indent}${paint(row)}`;
  }).join("\n");
}

export interface BannerOptions {
  version: string;
  /** `dev` or `prod`; only non-prod values are shown. */
  envLabel?: string;
}

/** Wordmark plus a one-line tagline and version. */
export function renderBanner(opts: BannerOptions): string {
  const envSuffix = opts.envLabel && opts.envLabel !== "prod" ? pc.yellow(` ${opts.envLabel}`) : "";
  return [
    "",
    renderWordmark(),
    "",
    `  ${pc.dim(TAGLINE)}  ${pc.dim(`v${opts.version}`)}${envSuffix}`,
    "",
  ].join("\n");
}

export interface QuickStartRow {
  command: string;
  description: string;
}

export const QUICK_START: readonly QuickStartRow[] = [
  { command: "wrapper auth login", description: "Sign in with your Wrapper account" },
  { command: "wrapper share", description: "Wrap this shell and share it" },
  { command: "wrapper status", description: "List active sessions" },
  { command: "wrapper --help", description: "See all commands" },
];

/** First-run welcome: banner, quick start, telemetry notice. */
export function renderWelcome(opts: BannerOptions): string {
  const width = Math.max(...QUICK_START.map((row) => row.command.length));
  const rows = QUICK_START.map(
    (row) =>
      `    ${pc.dim("$")} ${pc.cyan(row.command.padEnd(width))}   ${pc.dim(row.description)}`,
  );
  return [
    renderBanner(opts),
    `  ${pc.green("✓")} Ready to use`,
    "",
    `  ${pc.bold("Get started")}`,
    ...rows,
    "",
    `  ${pc.dim("Anonymous telemetry is off. Run")} ${pc.white("wrapper telemetry enable")} ${pc.dim("to opt in.")}`,
    "",
  ].join("\n");
}

/** Inline tag used for host/viewer messages inside a live shell. */
export function tag(): string {
  return `${pc.cyan("◆")} ${pc.dim("wrapper")}`;
}

/** Section header for command output, e.g. `◆ wrapper status`. */
export function heading(title: string, meta?: string): string {
  const suffix = meta ? `  ${pc.dim("·")}  ${pc.dim(meta)}` : "";
  return `${pc.cyan("◆")} ${pc.bold(`wrapper ${title}`)}${suffix}`;
}

/** clack intro title with the brand chip. */
export function introTitle(subcommand: string, envLabel?: string): string {
  const chip = pc.bgCyan(pc.black(" wrapper "));
  const env = envLabel && envLabel !== "prod" ? ` ${pc.yellow(envLabel)}` : "";
  return `${chip} ${subcommand}${env}`;
}

export function ok(text: string): string {
  return `${pc.green("✓")} ${text}`;
}

export function warn(text: string): string {
  return `${pc.yellow("!")} ${text}`;
}

export function fail(text: string): string {
  return `${pc.red("✗")} ${text}`;
}

export function info(text: string): string {
  return `${pc.cyan("•")} ${text}`;
}

/** A `$ command` line for copy-paste hints. */
export function command(text: string): string {
  return `${pc.dim("$")} ${pc.cyan(text)}`;
}

/** Right-align labels so `kv` rows line up in a block. */
export function kv(label: string, value: string, width = 10): string {
  return `${pc.dim(`${label}:`.padEnd(width + 1))} ${value}`;
}

/** Share codes are eight Crockford characters; show them as XXXX-XXXX. */
export function formatShareCode(code: string): string {
  const clean = code.replace(/-/g, "").toUpperCase();
  if (clean.length !== 8) return code;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}
