import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureBundledPtyHelper } from "../util/bundled-helper";
import pkg from "../package.json";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function executableDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "wrapper-helper-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("compiled CLI helper discovery", () => {
  test("uses the ARM64 Linux helper shipped beside the executable", () => {
    const directory = executableDirectory();
    writeFileSync(join(directory, "wrapper-pty-helper-aarch64-linux-musl"), "helper");
    const env: Record<string, string | undefined> = {};

    expect(
      configureBundledPtyHelper({
        architecture: "arm64",
        env,
        executablePath: join(directory, "wrapper"),
        platform: "linux",
      }),
    ).toBe(directory);
    expect(env.WRAPPER_PTY_HELPER_DIR).toBe(directory);
  });

  test("does not alter source runs without a sibling helper", () => {
    const directory = executableDirectory();
    const env: Record<string, string | undefined> = {};

    expect(
      configureBundledPtyHelper({
        architecture: "x64",
        env,
        executablePath: join(directory, "bun"),
        platform: "darwin",
      }),
    ).toBeNull();
    expect(env.WRAPPER_PTY_HELPER_DIR).toBeUndefined();
  });

  test("preserves an explicit helper directory override", () => {
    const env = { WRAPPER_PTY_HELPER_DIR: "/custom/helpers" };
    expect(configureBundledPtyHelper({ env, executablePath: "/missing/wrapper" })).toBe(
      "/custom/helpers",
    );
  });
});

describe("release command output", () => {
  test("--version is machine-readable on first run", () => {
    const home = executableDirectory();
    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, "..", "index.ts"), "--version"],
      {
        env: {
          ...process.env,
          HOME: home,
          NODE_ENV: "production",
          WRAPPER_LOG: "off",
        },
        stderr: "pipe",
        stdout: "pipe",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(`${pkg.version}\n`);
    expect(result.stderr.toString()).not.toContain("Ready to use");
  });
});
