import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { env } from "../util/env";
import { paths } from "../util/paths";

/**
 * Shell detection.
 *
 * We support the three shells that account for ~95 % of real-world POSIX
 * usage: zsh, bash, fish. Other shells (dash, ksh, nushell, tcsh) are
 * intentionally excluded — they either have incompatible syntax or are
 * niche enough that hand-editing the rc file is fine.
 *
 * In dev mode the rc paths are redirected into the dev XDG state directory
 * so a developer running `bun run dev install` can never corrupt their real
 * `~/.zshrc`. The paths there look like `<state>/fake-rc/.zshrc`.
 */

export type SupportedShell = "zsh" | "bash" | "fish";

export interface DetectedShell {
  /** Friendly identifier used in commands and config. */
  name: SupportedShell;
  /** Absolute path to the shell binary (e.g. /bin/zsh). */
  binary: string;
  /** Absolute path to the rc file we will patch. */
  rcFile: string;
  /** True if this is the user's current `$SHELL`. */
  isDefault: boolean;
  /** True if the rc file already exists on disk. */
  rcExists: boolean;
}

const HOME = homedir();

const PROD_RC_PATHS: Record<SupportedShell, string> = {
  zsh: join(HOME, ".zshrc"),
  bash: join(HOME, ".bashrc"),
  fish: join(HOME, ".config", "fish", "config.fish"),
};

function devRcPath(name: SupportedShell): string {
  const dir = join(paths.state(), "fake-rc");
  if (name === "fish") return join(dir, "config.fish");
  return join(dir, `.${name}rc`);
}

const RC_PATHS: Record<SupportedShell, string> = env.isDev
  ? {
      zsh: devRcPath("zsh"),
      bash: devRcPath("bash"),
      fish: devRcPath("fish"),
    }
  : PROD_RC_PATHS;

const COMMON_PATHS: Record<SupportedShell, string[]> = {
  zsh: ["/bin/zsh", "/usr/bin/zsh", "/usr/local/bin/zsh", "/opt/homebrew/bin/zsh"],
  bash: ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/opt/homebrew/bin/bash"],
  fish: ["/usr/bin/fish", "/usr/local/bin/fish", "/opt/homebrew/bin/fish"],
};

/** Best-effort: $SHELL → SupportedShell (if recognised). */
export function currentShell(): SupportedShell | null {
  const sh = process.env.SHELL;
  if (!sh) return null;
  const base = basename(sh);
  return isSupported(base) ? base : null;
}

/**
 * Find every supported shell that looks installed on this machine. A shell
 * counts as "installed" if any of its common binary paths exists OR if it
 * matches `$SHELL`. We never invoke `which`/`command -v` — Bun.spawn for
 * a probe is slower than touching a few well-known paths.
 */
export function detectAvailableShells(): DetectedShell[] {
  const current = currentShell();
  const result: DetectedShell[] = [];

  for (const name of ["zsh", "bash", "fish"] as const) {
    const binary =
      ($SHELLMatches(name) ? (process.env.SHELL ?? "") : "") ||
      COMMON_PATHS[name].find((p) => existsSync(p)) ||
      "";
    if (!binary) continue;
    const rcFile = RC_PATHS[name];
    result.push({
      name,
      binary,
      rcFile,
      isDefault: current === name,
      rcExists: existsSync(rcFile),
    });
  }

  return result;
}

/** Resolve a shell descriptor by name. Returns null if it isn't installed. */
export function resolveShell(name: SupportedShell): DetectedShell | null {
  return detectAvailableShells().find((s) => s.name === name) ?? null;
}

function isSupported(name: string): name is SupportedShell {
  return name === "zsh" || name === "bash" || name === "fish";
}

function $SHELLMatches(name: SupportedShell): boolean {
  const sh = process.env.SHELL;
  return sh ? basename(sh) === name : false;
}
