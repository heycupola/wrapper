import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

type Platform = "darwin" | "linux";
type Architecture = "arm64" | "x64";

const helperTriple: Record<Platform, Record<Architecture, string>> = {
  darwin: {
    arm64: "aarch64-macos-none",
    x64: "x86_64-macos-none",
  },
  linux: {
    arm64: "aarch64-linux-musl",
    x64: "x86_64-linux-musl",
  },
};

export interface BundledHelperOptions {
  env?: Record<string, string | undefined>;
  executablePath?: string;
  platform?: NodeJS.Platform;
  architecture?: NodeJS.Architecture;
}

/**
 * Point @repo/terminal at the native helper shipped beside a compiled CLI.
 * Source runs keep using @repo/terminal's development fallback.
 */
export function configureBundledPtyHelper(options: BundledHelperOptions = {}): string | null {
  const env = options.env ?? process.env;
  if (env.WRAPPER_PTY_HELPER_DIR) return env.WRAPPER_PTY_HELPER_DIR;

  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  if (!(platform in helperTriple) || !["arm64", "x64"].includes(architecture)) return null;

  const triple = helperTriple[platform as Platform][architecture as Architecture];
  const executableDirectory = dirname(options.executablePath ?? process.execPath);
  const helper = join(executableDirectory, `wrapper-pty-helper-${triple}`);
  if (!existsSync(helper)) return null;

  env.WRAPPER_PTY_HELPER_DIR = executableDirectory;
  return executableDirectory;
}
