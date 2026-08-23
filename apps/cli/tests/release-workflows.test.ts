import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..", "..", "..");
const releaseWorkflow = readFileSync(
  resolve(repositoryRoot, ".github", "workflows", "release-cli.yml"),
  "utf8",
);
const dryRunWorkflow = readFileSync(
  resolve(repositoryRoot, ".github", "workflows", "release-dry-run.yml"),
  "utf8",
);
const homebrewWorkflow = readFileSync(
  resolve(repositoryRoot, ".github", "workflows", "update-homebrew-tap.yml"),
  "utf8",
);
const installer = readFileSync(
  resolve(repositoryRoot, "apps", "cli", "scripts", "install.sh"),
  "utf8",
);

interface ReleaseTarget {
  archive: string;
  helper: string;
  os: string;
  platform: string;
  target: string;
}

const expectedTargets: ReleaseTarget[] = [
  {
    archive: "wrapper-darwin-arm64.tar.gz",
    helper: "wrapper-pty-helper-aarch64-macos-none",
    os: "macos-latest",
    platform: "darwin-arm64",
    target: "bun-darwin-arm64",
  },
  {
    archive: "wrapper-darwin-x86_64.tar.gz",
    helper: "wrapper-pty-helper-x86_64-macos-none",
    os: "macos-latest",
    platform: "darwin-x64",
    target: "bun-darwin-x64",
  },
  {
    archive: "wrapper-linux-x86_64.tar.gz",
    helper: "wrapper-pty-helper-x86_64-linux-musl",
    os: "ubuntu-latest",
    platform: "linux-x64",
    target: "bun-linux-x64",
  },
  {
    archive: "wrapper-linux-arm64.tar.gz",
    helper: "wrapper-pty-helper-aarch64-linux-musl",
    os: "ubuntu-latest",
    platform: "linux-arm64",
    target: "bun-linux-arm64",
  },
];

function releaseTargets(workflow: string): ReleaseTarget[] {
  return [
    ...workflow.matchAll(
      /- os: ([^\n]+)\n\s+platform: ([^\n]+)\n\s+target: ([^\n]+)\n\s+archive: ([^\n]+)\n\s+helper: ([^\n]+)/g,
    ),
  ].map((match) => ({
    archive: match[4]!,
    helper: match[5]!,
    os: match[1]!,
    platform: match[2]!,
    target: match[3]!,
  }));
}

function archiveNames(contents: string): Set<string> {
  return new Set(contents.match(/wrapper-(?:darwin|linux)-[A-Za-z0-9_]+\.tar\.gz/g) ?? []);
}

describe("CLI release workflows", () => {
  test("production and dry-run matrices package the same four targets", () => {
    expect(releaseTargets(releaseWorkflow)).toEqual(expectedTargets);
    expect(releaseTargets(dryRunWorkflow)).toEqual(expectedTargets);
  });

  test("release assets, checksums, Homebrew, and installer use one archive name set", () => {
    const expectedArchives = new Set(expectedTargets.map(({ archive }) => archive));
    expect(archiveNames(releaseWorkflow)).toEqual(expectedArchives);
    expect(archiveNames(dryRunWorkflow)).toEqual(expectedArchives);
    expect(archiveNames(homebrewWorkflow)).toEqual(expectedArchives);
    expect(installer).toContain('archive="wrapper-${platform}.tar.gz"');

    for (const target of expectedTargets) {
      const installerPlatform = target.archive.replace("wrapper-", "").replace(".tar.gz", "");
      expect(releaseWorkflow).toContain(target.helper);
      expect(dryRunWorkflow).toContain(target.helper);
      expect(homebrewWorkflow).toContain(target.archive);
      expect(installer).toContain(`platform="${installerPlatform}"`);
      expect(installer).toContain(target.helper);
    }
  });

  test("the first-release version check does not mutate package.json", () => {
    expect(releaseWorkflow).toContain('git show "${BEFORE_SHA}:apps/cli/package.json"');
    expect(releaseWorkflow).not.toContain("git checkout HEAD~1 -- apps/cli/package.json");
    expect(releaseWorkflow).toContain("REQUESTED_VERSION");
    expect(releaseWorkflow).toContain("refs/heads/main");
    expect(releaseWorkflow).toContain("refs/tags/v${CURRENT}");
    expect(releaseWorkflow).toContain("skipping automatic release");
    expect(releaseWorkflow).not.toContain('PREVIOUS="0.0.0"');
  });

  test("dry run verifies the complete checksum set without publishing", () => {
    expect(dryRunWorkflow).toContain("Verify release asset set");
    expect(dryRunWorkflow).toContain("sha256sum --check checksums.txt");
    expect(dryRunWorkflow).toContain("COPYFILE_DISABLE=1 tar");
    expect(releaseWorkflow).toContain("COPYFILE_DISABLE=1 tar");
    expect(dryRunWorkflow).toContain("smoke-release-binary.py");
    expect(releaseWorkflow).toContain("smoke-release-binary.py");
    expect(dryRunWorkflow).not.toContain("action-gh-release");
    expect(dryRunWorkflow).not.toContain("git push");
  });

  test("Homebrew compares formula hashes with release checksums and GitHub digests", () => {
    expect(homebrewWorkflow).toContain("release-metadata/checksums.txt");
    expect(homebrewWorkflow).toContain("checksum_digest != asset_digest");
    expect(homebrewWorkflow).toContain("SHA_LINUX_ARM64");
    expect(homebrewWorkflow).toContain("ruby -c Formula/wrapper.rb");
    expect(homebrewWorkflow).toContain('homepage "https://www.wrapper.sh"');
    expect(homebrewWorkflow).toContain('bin.install "wrapper"');
    expect(homebrewWorkflow).toContain('bin.install Dir["wrapper-pty-helper-*"]');
    expect(homebrewWorkflow).not.toContain('bin.install "bin/wrapper"');
  });
});
