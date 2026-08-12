import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import extract from "extract-zip";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("patched extractor rejects symlinks outside the destination", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wrapper-extract-zip-"));
  temporaryDirectories.push(directory);
  const archivePath = join(directory, "malicious.zip");
  const destination = join(directory, "destination");
  const python = String.raw`
import stat
import sys
import zipfile

entry = zipfile.ZipInfo("escape")
entry.create_system = 3
entry.external_attr = (stat.S_IFLNK | 0o777) << 16

with zipfile.ZipFile(sys.argv[1], "w") as archive:
    archive.writestr(entry, "../../outside")
`;
  const fixture = Bun.spawnSync(["python3", "-c", python, archivePath]);
  expect(fixture.exitCode).toBe(0);

  await expect(extract(archivePath, { dir: destination })).rejects.toThrow(
    'Out of bound symlink "../../outside"',
  );
});
