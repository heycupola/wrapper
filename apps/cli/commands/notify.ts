/**
 * `wrapper notify` — ring the wrapped terminal so the host can ping your phone.
 * Run it inside a wrapped session. It writes a bell; the host never sends
 * terminal contents with the alert.
 */
export async function runNotify(): Promise<void> {
  if (process.env.WRAPPER_WRAPPED !== "1") {
    process.stderr.write("wrapper: run `wrapper notify` inside a wrapped terminal.\n");
    process.exit(2);
  }
  process.stdout.write("\x07");
}
