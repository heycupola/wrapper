import * as p from "@clack/prompts";
import { trackEvent } from "@repo/logger";
import { detectAvailableShells, type DetectedShell, type SupportedShell } from "../shell/detect";
import { unpatchRc } from "../shell/rc-edit";
import { env } from "../util/env";

/**
 * `wrapper uninstall` — remove our managed block from any rc file that
 * still has it. Backups are NOT removed; the user can delete those manually
 * if they want a clean home directory.
 */

export interface UninstallOptions {
  shellsCsv?: string;
  all?: boolean;
  yes?: boolean;
}

export async function runUninstall(opts: UninstallOptions): Promise<void> {
  p.intro(`wrapper uninstall (${env.label})`);

  const detected = detectAvailableShells();
  if (detected.length === 0) {
    p.cancel("No supported shells found.");
    process.exit(0);
  }

  let chosen: SupportedShell[];
  if (opts.all) {
    chosen = detected.map((s) => s.name);
  } else if (opts.shellsCsv) {
    chosen = parseShellsFlag(opts.shellsCsv, detected);
  } else {
    chosen = await promptForShells(detected);
    if (chosen.length === 0) {
      p.cancel("Nothing to uninstall.");
      process.exit(0);
    }
  }

  if (!opts.yes) {
    const confirm = await p.confirm({
      message: `Remove the wrapper block from ${chosen.length} rc file${chosen.length > 1 ? "s" : ""}?`,
      initialValue: true,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Aborted.");
      process.exit(0);
    }
  }

  let removed = 0;
  for (const name of chosen) {
    const desc = detected.find((s) => s.name === name);
    if (!desc) continue;
    const ok = unpatchRc(desc.rcFile);
    if (ok) {
      p.log.success(`${name}: removed from ${desc.rcFile}`);
      removed += 1;
    } else {
      p.log.info(`${name}: nothing to remove (${desc.rcFile})`);
    }
  }

  trackEvent("uninstall_completed", { shells: chosen, removed });

  p.outro(removed > 0 ? "Done." : "No changes were made.");
}

function parseShellsFlag(csv: string, detected: DetectedShell[]): SupportedShell[] {
  const requested = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const supported = new Set(detected.map((d) => d.name));
  const out: SupportedShell[] = [];
  for (const r of requested) {
    if (r !== "zsh" && r !== "bash" && r !== "fish") continue;
    if (!supported.has(r)) continue;
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
  const choice = await p.multiselect<SupportedShell>({
    message: "Which shells should Wrapper stop hooking?",
    options,
    initialValues: detected.map((s) => s.name),
    required: false,
  });
  if (p.isCancel(choice)) {
    p.cancel("Aborted.");
    process.exit(0);
  }
  return choice as SupportedShell[];
}
