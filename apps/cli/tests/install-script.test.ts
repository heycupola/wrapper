import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const installer = resolve(import.meta.dir, "..", "scripts", "install.sh");
const bash = Bun.which("bash");
const tar = Bun.which("tar");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function writeExecutable(path: string, contents: string): void {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function makeMocks(root: string): string {
  const bin = join(root, "mock-bin");
  mkdirSync(bin, { recursive: true });
  writeExecutable(
    join(bin, "uname"),
    `#!/usr/bin/env bash
case "\${1:-}" in
  -s) printf '%s\\n' "\${MOCK_UNAME_S}" ;;
  -m) printf '%s\\n' "\${MOCK_UNAME_M}" ;;
  *) exit 2 ;;
esac
`,
  );
  writeExecutable(
    join(bin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
destination=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|--output) destination="$2"; shift 2 ;;
    --retry) shift 2 ;;
    --fail|--silent|--show-error|--location) shift ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
printf '%s\\n' "$url" >> "\${MOCK_CURL_LOG}"
case "$url" in
  */releases/latest)
    if [ "\${MOCK_LATEST_FAILURE:-0}" = "1" ]; then
      printf 'mock latest-release failure\\n' >&2
      exit 22
    fi
    printf '{"tag_name":"%s"}\\n' "\${MOCK_LATEST_TAG:-v0.1.0}"
    ;;
  *)
    source_file="\${MOCK_RELEASE_DIR}/\${url##*/}"
    if [ ! -f "$source_file" ]; then
      printf 'mock asset not found: %s\\n' "$url" >&2
      exit 22
    fi
    cp "$source_file" "$destination"
    ;;
esac
`,
  );
  return bin;
}

function makeReleaseArchive(
  root: string,
  archive: string,
  helper: string,
  options: { checksum?: string; unexpectedEntry?: boolean } = {},
): string {
  if (!tar) throw new Error("tar is required for installer tests");

  const release = join(root, "release");
  const staging = join(root, "staging");
  mkdirSync(join(staging, "bin"), { recursive: true });
  writeExecutable(join(staging, "bin", "wrapper"), "#!/bin/sh\nprintf 'wrapper fixture\\n'\n");
  writeExecutable(join(staging, "bin", helper), "#!/bin/sh\nexit 0\n");
  if (options.unexpectedEntry) writeFileSync(join(staging, "unexpected.txt"), "unexpected");
  mkdirSync(release, { recursive: true });

  const archivePath = join(release, archive);
  const packed = spawnSync(tar, ["-czf", archivePath, "-C", staging, "."], { encoding: "utf8" });
  if (packed.status !== 0) {
    throw new Error(`could not create installer fixture: ${packed.stderr}`);
  }

  const digest =
    options.checksum ?? createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  writeFileSync(join(release, "checksums.txt"), `${digest}  ${archive}\n`);
  return release;
}

interface InstallerRunOptions {
  arch?: string;
  extraEnv?: NodeJS.ProcessEnv;
  mockBin?: string;
  os?: string;
  root: string;
  version?: string;
}

function runInstaller(options: InstallerRunOptions) {
  if (!bash) throw new Error("bash is required for installer tests");

  const home = join(options.root, "home");
  const install = join(options.root, "install");
  mkdirSync(home, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    MOCK_CURL_LOG: join(options.root, "curl.log"),
    MOCK_RELEASE_DIR: join(options.root, "release"),
    MOCK_UNAME_M: options.arch ?? "x86_64",
    MOCK_UNAME_S: options.os ?? "Linux",
    PATH: options.mockBin ? `${options.mockBin}:${process.env.PATH ?? ""}` : process.env.PATH,
    SHELL: "/bin/bash",
    WRAPPER_INSTALL_DIR: install,
    WRAPPER_RELEASE_REPO: "test/wrapper",
    ...options.extraEnv,
  };
  if (options.version !== undefined) env.WRAPPER_VERSION = options.version;
  else delete env.WRAPPER_VERSION;

  const result = spawnSync(bash, [installer], { encoding: "utf8", env });
  return {
    install,
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

describe("release installer", () => {
  test("installs and verifies the Linux ARM64 release", () => {
    const root = temporaryDirectory("wrapper-installer-arm64-");
    const mockBin = makeMocks(root);
    const archive = "wrapper-linux-arm64.tar.gz";
    const helper = "wrapper-pty-helper-aarch64-linux-musl";
    makeReleaseArchive(root, archive, helper);

    const result = runInstaller({ arch: "aarch64", mockBin, root, version: "0.1.0" });

    expect(result.status).toBe(0);
    expect(readFileSync(join(result.install, "bin", "wrapper"), "utf8")).toContain(
      "wrapper fixture",
    );
    expect(statSync(join(result.install, "bin", helper)).mode & 0o111).not.toBe(0);
    expect(readFileSync(join(root, "curl.log"), "utf8")).toContain(
      `/releases/download/v0.1.0/${archive}`,
    );
  });

  test("reports unsupported operating system and architecture pairs", () => {
    const root = temporaryDirectory("wrapper-installer-platform-");
    const result = runInstaller({
      arch: "i386",
      mockBin: makeMocks(root),
      os: "Darwin",
      root,
      version: "v0.1.0",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unsupported platform: Darwin i386");
  });

  test("explains when no latest release can be queried", () => {
    const root = temporaryDirectory("wrapper-installer-latest-");
    const result = runInstaller({
      extraEnv: { MOCK_LATEST_FAILURE: "1" },
      mockBin: makeMocks(root),
      root,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("repository may not have a published release yet");
  });

  test("rejects a checksum mismatch before extraction", () => {
    const root = temporaryDirectory("wrapper-installer-checksum-");
    const mockBin = makeMocks(root);
    makeReleaseArchive(
      root,
      "wrapper-linux-x86_64.tar.gz",
      "wrapper-pty-helper-x86_64-linux-musl",
      { checksum: "0".repeat(64) },
    );

    const result = runInstaller({ mockBin, root, version: "v0.1.0" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("checksum mismatch for wrapper-linux-x86_64.tar.gz");
    expect(() => statSync(join(result.install, "bin", "wrapper"))).toThrow();
  });

  test("rejects unexpected archive entries", () => {
    const root = temporaryDirectory("wrapper-installer-layout-");
    const mockBin = makeMocks(root);
    makeReleaseArchive(
      root,
      "wrapper-linux-x86_64.tar.gz",
      "wrapper-pty-helper-x86_64-linux-musl",
      { unexpectedEntry: true },
    );

    const result = runInstaller({ mockBin, root, version: "v0.1.0" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("contains an unexpected or unsafe entry");
  });

  test("lists missing base commands before doing network work", () => {
    const root = temporaryDirectory("wrapper-installer-tools-");
    const emptyPath = join(root, "empty-path");
    mkdirSync(emptyPath);

    const result = runInstaller({
      extraEnv: { PATH: emptyPath },
      mockBin: emptyPath,
      root,
      version: "v0.1.0",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing required command(s)");
    expect(result.stderr).toContain("curl");
  });

  test("checks for a SHA-256 utility before downloading", () => {
    const root = temporaryDirectory("wrapper-installer-sha-tool-");
    const tools = join(root, "tools");
    mkdirSync(tools);
    for (const command of [
      "curl",
      "tar",
      "grep",
      "sed",
      "uname",
      "mktemp",
      "mkdir",
      "chmod",
      "cp",
      "mv",
      "rm",
    ]) {
      const executable = Bun.which(command);
      if (!executable) throw new Error(`test requires ${command}`);
      symlinkSync(executable, join(tools, command));
    }

    const result = runInstaller({
      extraEnv: { PATH: tools },
      mockBin: tools,
      root,
      version: "v0.1.0",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing checksum tool");
  });
});
