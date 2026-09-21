import { command, tag } from "../util/ui";
import { runShellHost } from "./shell-host";

/**
 * `wrapper run -- <cmd>` — wrap one command without patching your shell config.
 * Stays local until the host presses share, unless `--share` is set.
 */
export interface RunOptions {
  command: string[];
  port?: number;
  share?: boolean;
  writable?: boolean;
}

export async function runRun(opts: RunOptions): Promise<void> {
  if (process.env.WRAPPER_WRAPPED === "1") {
    process.stderr.write(
      `${tag()} this shell is already wrapped. Press Ctrl+\\ then s to share it.\n`,
    );
    process.exit(0);
  }

  const argv = opts.command.filter((part) => part.length > 0);
  if (argv.length === 0) {
    process.stderr.write(
      `${tag()} run needs a command. Example: ${command("wrapper run -- claude")}\n`,
    );
    process.exit(2);
  }

  process.stderr.write(`${tag()} wrapping ${command(argv.join(" "))}\n`);
  await runShellHost({
    shareOnStart: Boolean(opts.share),
    writableOnStart: Boolean(opts.writable),
    argv,
    port: opts.port,
  });
}
