import { getTelemetryPreference, saveTelemetryPreference } from "@repo/logger";
import pc from "picocolors";

/**
 * `wrapper telemetry status|enable|disable`
 *
 * Privacy-first by design:
 *   - Wrapper never collects shell input, file contents, or session payloads.
 *   - The opt-in flag lives at `<config>/wrapper/telemetry.json` (or
 *     `<config>/wrapper-dev/telemetry.json` in dev mode).
 *   - Setting `WRAPPER_TELEMETRY=false` in the environment overrides the
 *     stored preference for that single invocation.
 *
 * The implementation is a near-verbatim port of Relic's telemetry command
 * so the two products keep the same user-facing vocabulary.
 */

export async function telemetryStatus(): Promise<void> {
  const preference = getTelemetryPreference();

  if (preference === null) {
    console.log(`Telemetry: ${pc.green("enabled")} ${pc.dim("(default)")}`);
  } else if (preference) {
    console.log(`Telemetry: ${pc.green("enabled")}`);
  } else {
    console.log(`Telemetry: ${pc.yellow("disabled")}`);
  }

  console.log();
  console.log(pc.dim("Wrapper collects anonymous usage data to improve the product."));
  console.log(pc.dim("No keystrokes, shell output, or personal data are ever collected."));
}

export async function telemetryEnable(): Promise<void> {
  saveTelemetryPreference(true);
  console.log(pc.green("Telemetry enabled"));
}

export async function telemetryDisable(): Promise<void> {
  saveTelemetryPreference(false);
  console.log(pc.yellow("Telemetry disabled"));
}
