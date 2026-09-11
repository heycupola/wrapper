import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snippet } from "../commands/init";
import { renderBlock } from "../shell/rc-edit";
import { patchRc, unpatchRc } from "../shell/rc-edit";

describe("share-first CLI surface", () => {
  test("init snippet still guards nested exec", () => {
    const out = snippet("zsh");
    expect(out).toContain("exec wrapper shell-host");
    expect(out).toContain("WRAPPER_DISABLE");
  });

  test("--help lists share and run without patching shell config", () => {
    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, "..", "index.ts"), "--help"],
      {
        env: { ...process.env, WRAPPER_LOG: "off" },
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const help = result.stdout.toString();
    expect(help).toContain("share");
    expect(help).toContain("run");
    expect(help).toMatch(/does not\s+patch your shell config/);
  });

  test("share inside a wrapped shell exits without nesting", () => {
    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, "..", "index.ts"), "share"],
      {
        env: {
          ...process.env,
          WRAPPER_WRAPPED: "1",
          WRAPPER_LOG: "off",
        },
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("already wrapped");
  });

  test("install dry-run block writes the init snippet without wrapping logic", () => {
    const block = renderBlock("zsh");
    expect(block).toContain("# >>> wrapper init >>>");
    expect(block).toContain("wrapper init zsh");
    expect(block).not.toContain("session:open");
  });

  test("patchRc is idempotent and unpatchRc removes the block", () => {
    const dir = mkdtempSync(join(tmpdir(), "wrapper-rc-"));
    const rcFile = join(dir, ".zshrc");
    const first = patchRc("zsh", rcFile);
    expect(first.outcome).toBe("added");
    const text = readFileSync(rcFile, "utf8");
    expect(text).toContain("wrapper init zsh");
    const second = patchRc("zsh", rcFile);
    expect(second.outcome).toBe("already-present");
    expect(unpatchRc(rcFile)).toBe(true);
    expect(readFileSync(rcFile, "utf8")).not.toContain("wrapper init zsh");
  });
});
