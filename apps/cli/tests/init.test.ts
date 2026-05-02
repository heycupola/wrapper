import { describe, expect, test } from "bun:test";
import { snippet } from "../commands/init";

/**
 * `wrapper init <shell>` is the only contract between the wrapping CLI and
 * the user's shell startup. The snippet must be tiny, idempotent (the guard
 * env vars short-circuit re-execs), and syntactically valid for the target
 * shell. We assert all three by structure, not by implementation detail.
 */

describe("wrapper init snippet", () => {
  for (const shell of ["zsh", "bash"] as const) {
    test(`${shell}: posix-style guarded exec`, () => {
      const out = snippet(shell);
      expect(out).toContain('[ -z "$WRAPPER_WRAPPED" ]');
      expect(out).toContain('[ -z "$WRAPPER_DISABLE" ]');
      expect(out).toContain("exec wrapper shell-host");
      // No trailing newline (caller decides framing).
      expect(out.endsWith("\n")).toBe(false);
    });
  }

  test("fish: fish-syntax guarded exec", () => {
    const out = snippet("fish");
    expect(out).toContain("if not set -q WRAPPER_WRAPPED");
    expect(out).toContain("not set -q WRAPPER_DISABLE");
    expect(out).toContain("exec wrapper shell-host");
    expect(out).toContain("end");
  });
});
