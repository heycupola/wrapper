import { runShellHost } from "./shell-host";

/**
 * `wrapper share [cmd...]` — wrap `$SHELL` (or a command) and share it.
 * Does not patch your shell config. If this process is already inside a wrapped
 * shell, tell the user to press the prefix instead of nesting.
 */
export interface ShareOptions {
  command?: string[];
  port?: number;
  writable?: boolean;
}

export async function runShare(opts: ShareOptions = {}): Promise<void> {
  if (process.env.WRAPPER_WRAPPED === "1") {
    process.stderr.write(
      "wrapper: this shell is already wrapped. Press Ctrl+\\ then s to share it.\n",
    );
    process.exit(0);
  }

  const command = opts.command?.filter((part) => part.length > 0);
  await runShellHost({
    shareOnStart: true,
    writableOnStart: Boolean(opts.writable),
    argv: command && command.length > 0 ? command : undefined,
    port: opts.port,
  });
}
