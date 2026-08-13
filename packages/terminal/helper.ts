/*
 * Locates the wrapper-pty-helper binary on disk.
 *
 * The helper is a tiny native shim that performs the post-fork
 * controlling-tty dance Bun.spawn cannot do in JavaScript. We ship one
 * binary per supported triple and resolve the right one at runtime
 * based on `process.platform` + `process.arch`.
 *
 * The CLI sets WRAPPER_PTY_HELPER_DIR to its bundled bin directory so
 * the helper lookup works for both `bun run` and `bun build --compile`
 * deployments. When that env var is unset (e.g. running this package
 * from its own tests) we fall back to the dev-time path under
 * `apps/cli/bin`.
 */

import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Triple =
  | "aarch64-macos-none"
  | "x86_64-macos-none"
  | "aarch64-linux-musl"
  | "x86_64-linux-musl";

function detectTriple(): Triple {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "aarch64-macos-none";
  if (platform === "darwin" && arch === "x64") return "x86_64-macos-none";
  if (platform === "linux" && arch === "arm64") return "aarch64-linux-musl";
  if (platform === "linux" && arch === "x64") return "x86_64-linux-musl";

  throw new Error(`@repo/terminal: unsupported platform/arch combination ${platform}/${arch}`);
}

function packageDir(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return here;
}

/**
 * Resolves the absolute path to the wrapper-pty-helper binary that
 * matches the current host. Throws if no binary is found, including
 * the candidates we tried so the caller can surface a useful error.
 */
export function resolveHelperPath(): string {
  const candidates: string[] = [];
  const triple = detectTriple();

  const fromEnv = process.env["WRAPPER_PTY_HELPER_DIR"];
  if (fromEnv) {
    candidates.push(join(fromEnv, `wrapper-pty-helper-${triple}`));
    candidates.push(join(fromEnv, "wrapper-pty-helper"));
  }

  const devBin = resolve(packageDir(), "..", "..", "apps", "cli", "bin");
  candidates.push(join(devBin, `wrapper-pty-helper-${triple}`));
  candidates.push(join(devBin, "wrapper-pty-helper"));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const st = statSync(candidate);
      if (st.isFile()) return candidate;
    }
  }

  throw new Error(
    `@repo/terminal: wrapper-pty-helper not found for ${triple}.\n` +
      `Tried:\n  - ${candidates.join("\n  - ")}\n` +
      `Build it with \`make\` in tools/pty-helper/.`,
  );
}
