#!/usr/bin/env bun
import { initLogger, isFirstRun, saveTelemetryPreference } from "@repo/logger";
import { Command } from "commander";
import pc from "picocolors";
import { runAttach } from "./commands/attach";
import { runAuthLogin, runAuthLogout, runAuthWhoami } from "./commands/auth";
import { runInit } from "./commands/init";
import { runInstall } from "./commands/install";
import { runLogs } from "./commands/logs";
import { runShellHost } from "./commands/shell-host";
import { runStatus } from "./commands/status";
import { telemetryDisable, telemetryEnable, telemetryStatus } from "./commands/telemetry";
import { runUninstall } from "./commands/uninstall";
import type { SupportedShell } from "./shell/detect";
import { configureBundledPtyHelper } from "./util/bundled-helper";
import pkg from "./package.json";

configureBundledPtyHelper();

// Single source of truth: the published package version. Keeping this in sync
// with package.json ensures `wrapper --version` matches release/Homebrew.
const VERSION = pkg.version;
const SUPPORTED_SHELLS: SupportedShell[] = ["zsh", "bash", "fish"];

const subcommand = process.argv[2];
const isInformationalEntry = process.argv.some((arg) =>
  ["--help", "-h", "--version", "-V"].includes(arg),
);

// `wrapper logs` reads the log file — calling `initLogger()` would truncate
// it in dev mode (debug-log behaviour, see @repo/logger). Skip the boot for
// that one command so users always see the live tail.
const isLogsRead = subcommand === "logs";

// Boot the shared logger early for everything else: in dev this resets the
// log file each run, and in prod it registers a beforeExit hook that flushes
// pending PostHog events.
if (!isLogsRead) {
  await initLogger();
}

// Show the first-run banner + telemetry consent ONLY for interactive,
// user-initiated invocations. Skip it for `shell-host` (rc hook entry point)
// and for `init` (dotfile evaluation), neither of which has a user watching.
const isQuietEntry =
  isInformationalEntry ||
  subcommand === "shell-host" ||
  subcommand === "init" ||
  subcommand === "logs" ||
  process.env.WRAPPER_WRAPPED === "1";
if (!isQuietEntry && isFirstRun()) {
  console.error();
  console.error(`  ${pc.bold("wrapper")} ${pc.dim(`v${VERSION}`)}`);
  console.error(`  ${pc.dim("Bring your terminal to your phone, on demand.")}`);
  console.error();
  console.error(`  ${pc.green("✓")} ${pc.dim("Ready to use")}`);
  console.error();
  console.error(`  ${pc.dim("Get started:")}`);
  console.error(
    `    ${pc.dim("$")} ${pc.cyan("wrapper install")}    ${pc.dim("Hook Wrapper into your shell rc files")}`,
  );
  console.error(
    `    ${pc.dim("$")} ${pc.cyan("wrapper status")}     ${pc.dim("List active sessions")}`,
  );
  console.error(
    `    ${pc.dim("$")} ${pc.cyan("wrapper --help")}     ${pc.dim("See all commands")}`,
  );
  console.error();
  console.error(
    `  ${pc.dim("Anonymous telemetry is disabled by default. Run")} ${pc.white("wrapper telemetry enable")} ${pc.dim("to opt in.")}`,
  );
  console.error();
  saveTelemetryPreference(false);
}

const program = new Command();
program
  .name("wrapper")
  .description("Wrapper - one command to make your terminal reachable from your phone")
  .version(VERSION);

program
  .command("install")
  .description("Hook Wrapper into your shell rc files (interactive)")
  .option("-s, --shell <list>", "comma-separated list of shells (zsh,bash,fish)")
  .option("--all", "install for every detected shell")
  .option("-i, --interactive", "always show the picker, even with one shell")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(async (raw) => {
    await runInstall({
      shellsCsv: raw.shell,
      all: Boolean(raw.all),
      interactive: Boolean(raw.interactive),
      yes: Boolean(raw.yes),
    });
  });

program
  .command("uninstall")
  .description("Remove Wrapper hooks from your shell rc files")
  .option("-s, --shell <list>", "comma-separated list of shells (zsh,bash,fish)")
  .option("--all", "uninstall from every detected shell")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(async (raw) => {
    await runUninstall({
      shellsCsv: raw.shell,
      all: Boolean(raw.all),
      yes: Boolean(raw.yes),
    });
  });

program
  .command("init")
  .description("Print the eval/source snippet for the given shell (used by rc hook)")
  .argument("<shell>", `one of: ${SUPPORTED_SHELLS.join(", ")}`)
  .action(async (rawShell: string) => {
    const shell = rawShell.toLowerCase() as SupportedShell;
    if (!SUPPORTED_SHELLS.includes(shell)) {
      process.stderr.write(`wrapper: unsupported shell '${rawShell}'\n`);
      process.exit(2);
    }
    await runInit({ shell });
  });

program
  .command("shell-host")
  .description("Wrap the current shell (used internally by `wrapper init`)")
  .option("-s, --shell <path>", "shell binary to spawn (defaults to $SHELL)")
  .option("-p, --port <number>", "force a specific port (default: OS-assigned)")
  .action(async (raw) => {
    await runShellHost({
      shell: raw.shell,
      port: raw.port ? Number(raw.port) : undefined,
    });
  });

program
  .command("attach")
  .description("Attach the current terminal to a running Wrapper session")
  .option("-i, --id <sessionId>", "specific session id (skips picker)")
  .option("-p, --port <number>", "explicit port (skips registry lookup)")
  .option("-H, --host <hostname>", "host running the session", "127.0.0.1")
  .option("-r, --relay", "attach via relay using backend-issued ticket")
  .option(
    "-c, --code <code>",
    "share code for non-interactive use (interactive attach prompts securely)",
  )
  .action(async (raw) => {
    await runAttach({
      id: raw.id,
      port: raw.port ? Number(raw.port) : undefined,
      host: raw.host,
      relay: Boolean(raw.relay),
      code: raw.code,
    });
  });

program
  .command("status")
  .description("List active Wrapper sessions on this machine")
  .action(async () => {
    await runStatus();
  });

program
  .command("logs")
  .description("Tail the Wrapper log file")
  .option("-f, --follow", "stream new lines as they arrive", false)
  .option("-n, --tail <number>", "number of lines to print first", "200")
  .action(async (raw) => {
    await runLogs({
      follow: Boolean(raw.follow),
      tail: Number(raw.tail),
    });
  });

const telemetryCmd = program
  .command("telemetry")
  .description("Manage anonymous usage data collection");
telemetryCmd.command("status").description("Show telemetry status").action(telemetryStatus);
telemetryCmd.command("enable").description("Enable telemetry").action(telemetryEnable);
telemetryCmd.command("disable").description("Disable telemetry").action(telemetryDisable);

const authCmd = program.command("auth").description("Authenticate Wrapper CLI");
authCmd
  .command("login")
  .description("Start device authorization flow")
  .option("--client-id <clientId>", "OAuth client id")
  .option("--scope <scope>", "OAuth scope")
  .action(async (raw) => {
    await runAuthLogin({
      clientId: raw.clientId,
      scope: raw.scope,
    });
  });
authCmd.command("whoami").description("Show current auth session").action(runAuthWhoami);
authCmd.command("logout").description("Remove local auth session").action(runAuthLogout);

await program.parseAsync(process.argv);
