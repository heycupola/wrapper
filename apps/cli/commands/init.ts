import type { SupportedShell } from "../shell/detect";

/**
 * `wrapper init <shell>` prints the snippet a user should `eval` (or
 * `source`, for fish) in their rc file. It's the only contract between the
 * CLI binary and the user's shell startup — keeping the snippet tiny means
 * users don't have to reinstall when the wrapping logic itself changes.
 *
 * Output is plain text on stdout. The caller (`eval` / `source`) executes
 * it as shell code.
 *
 * Guard semantics:
 *   - `WRAPPER_WRAPPED=1` is set by `wrapper shell-host` for the inner
 *     shell, so the inner shell short-circuits the next exec.
 *   - `WRAPPER_DISABLE=1` lets the user opt out for one terminal without
 *     editing their rc file.
 */

export interface InitOptions {
  shell: SupportedShell;
}

export async function runInit(opts: InitOptions): Promise<void> {
  process.stdout.write(`${snippet(opts.shell)}\n`);
}

export function snippet(shell: SupportedShell): string {
  switch (shell) {
    case "zsh":
    case "bash":
      return [
        `if [ -z "$WRAPPER_WRAPPED" ] && [ -z "$WRAPPER_DISABLE" ]; then`,
        `  exec wrapper shell-host`,
        `fi`,
      ].join("\n");
    case "fish":
      return [
        `if not set -q WRAPPER_WRAPPED; and not set -q WRAPPER_DISABLE`,
        `  exec wrapper shell-host`,
        `end`,
      ].join("\n");
  }
}
