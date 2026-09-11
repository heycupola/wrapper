import * as p from "@clack/prompts";
import { getLogsDir, trackEvent } from "@repo/logger";
import { join } from "node:path";
import { detectAvailableShells, type DetectedShell, type SupportedShell } from "../shell/detect";
import { patchRc, renderBlock, type PatchResult } from "../shell/rc-edit";
import { env } from "../util/env";
import { paths } from "../util/paths";

/**
 * `wrapper install` — optional: wrap every new shell by patching shell config.
 * Sharing does not require this. Prefer `wrapper share` unless you want
 * every terminal attachable.
 */

export interface InstallOptions {
  shellsCsv?: string;
  all?: boolean;
  interactive?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

export async function runInstall(opts: InstallOptions): Promise<void> {
  p.intro(`wrapper install (${env.label})`);

  const detected = detectAvailableShells();
  if (detected.length === 0) {
    p.cancel("No supported shells found. Install zsh, bash, or fish first.");
    process.exit(1);
  }

  let chosen: SupportedShell[];

  if (opts.all) {
    chosen = detected.map((s) => s.name);
    p.log.info(`Installing for all detected shells: ${chosen.join(", ")}`);
  } else if (opts.shellsCsv) {
    chosen = parseShellsFlag(opts.shellsCsv, detected);
    p.log.info(`Installing for: ${chosen.join(", ")}`);
  } else if (detected.length === 1 && !opts.interactive) {
    const only = detected[0]!;
    chosen = [only.name];
    p.log.info(`Detected ${only.name} (${only.rcFile}); installing.`);
  } else {
    chosen = await promptForShells(detected);
    if (chosen.length === 0) {
      p.cancel("Nothing to install.");
      process.exit(0);
    }
  }

  p.log.info(
    "Optional: wrap every new terminal. Sharing does not require this — use `wrapper share` instead.",
  );

  if (opts.dryRun) {
    for (const name of chosen) {
      const desc = detected.find((s) => s.name === name);
      if (!desc) continue;
      p.log.info(`${name}: would patch ${desc.rcFile}`);
      p.note(renderBlock(name), desc.rcFile);
    }
    p.log.info("Remove later with `wrapper uninstall`. Skip one shell with WRAPPER_DISABLE=1.");
    p.outro("Dry run — no files written.");
    return;
  }

  if (!opts.yes) {
    p.note(
      [
        ...chosen.map((name) => {
          const desc = detected.find((s) => s.name === name);
          return desc ? `${desc.rcFile}` : name;
        }),
        "Backup created before the first write.",
        "Remove with `wrapper uninstall`. Skip one shell with WRAPPER_DISABLE=1.",
      ].join("\n"),
      "Files",
    );
    const confirm = await p.confirm({
      message: `Patch ${chosen.length} rc file${chosen.length > 1 ? "s" : ""}? This execs wrapper around new interactive shells.`,
      initialValue: false,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Aborted.");
      process.exit(0);
    }
  }

  const results: { shell: SupportedShell; result: PatchResult }[] = [];
  for (const name of chosen) {
    const desc = detected.find((s) => s.name === name);
    if (!desc) continue;
    const result = patchRc(name, desc.rcFile);
    results.push({ shell: name, result });
  }

  for (const { shell, result } of results) {
    const verb =
      result.outcome === "added"
        ? "Added"
        : result.outcome === "updated"
          ? "Updated"
          : "Already up to date";
    const backup = result.backup ? ` (backup: ${result.backup})` : "";
    p.log.success(`${shell}: ${verb} → ${result.rcFile}${backup}`);
  }

  trackEvent("install_completed", {
    shells: results.map((r) => r.shell),
    outcomes: results.map((r) => r.result.outcome),
    count: results.length,
  });

  const logFile = join(getLogsDir(), env.isDev ? "debug.log" : "wrapper.log");
  p.note(
    [
      "Sharing does not need this. Use `wrapper share` from any unwrapped terminal.",
      "Run `source <rc-file>` or open a new terminal to start wrapping every shell.",
      `Logs: ${logFile}`,
      `Sessions: ${paths.sessionsRegistry()}`,
    ].join("\n"),
    "Next",
  );
  p.outro(env.isDev ? "Done (dev environment)." : "Done.");
}

function parseShellsFlag(csv: string, detected: DetectedShell[]): SupportedShell[] {
  const requested = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const supported = new Set(detected.map((d) => d.name));
  const out: SupportedShell[] = [];
  for (const r of requested) {
    if (r !== "zsh" && r !== "bash" && r !== "fish") {
      p.log.warn(`Unknown shell '${r}' (skipping). Supported: zsh, bash, fish.`);
      continue;
    }
    if (!supported.has(r)) {
      p.log.warn(`${r} is not installed on this machine (skipping).`);
      continue;
    }
    out.push(r);
  }
  return out;
}

async function promptForShells(detected: DetectedShell[]): Promise<SupportedShell[]> {
  const options = detected.map((s) => ({
    value: s.name,
    label: `${s.name}${s.isDefault ? "  (default)" : ""}`,
    hint: s.rcFile,
  }));
  const initialValue = detected.filter((s) => s.isDefault).map((s) => s.name);

  const choice = await p.multiselect<SupportedShell>({
    message: "Which shells should Wrapper add a line to?",
    options,
    initialValues: initialValue.length > 0 ? initialValue : [detected[0]!.name],
    required: false,
  });

  if (p.isCancel(choice)) {
    p.cancel("Aborted.");
    process.exit(0);
  }
  return choice as SupportedShell[];
}
