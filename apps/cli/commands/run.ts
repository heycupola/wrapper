import { runShellHost } from "./shell-host";

/**
 * `wrapper run -- <cmd>` — wrap one command without patching rc files.
 * Stays local until the host presses share, unless `--share` is set.
 */
export interface RunOptions {
  command: string[];
  port?: number;
  share?: boolean;
}

export async function runRun(opts: RunOptions): Promise<void> {
  if (process.env.WRAPPER_WRAPPED === "1") {
    process.stderr.write(
      "wrapper: this shell is already wrapped. Press Ctrl+\\ then s to share it.\n",
    );
    process.exit(0);
  }

  const command = opts.command.filter((part) => part.length > 0);
  if (command.length === 0) {
    process.stderr.write("wrapper: run requires a command. Example: wrapper run -- claude\n");
    process.exit(2);
  }

  await runShellHost({
    shareOnStart: Boolean(opts.share),
    argv: command,
    port: opts.port,
  });
}
