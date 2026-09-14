import { describe, expect, test } from "bun:test";
import { runNotify } from "../commands/notify";

describe("wrapper notify", () => {
  test("exits outside a wrapped terminal", async () => {
    const previous = process.env.WRAPPER_WRAPPED;
    delete process.env.WRAPPER_WRAPPED;
    const originalExit = process.exit;
    let code: number | undefined;
    process.exit = ((status?: number) => {
      code = status ?? 0;
      throw new Error("exit");
    }) as typeof process.exit;
    try {
      await runNotify();
    } catch {
      // mocked process.exit throws
    } finally {
      process.exit = originalExit;
      if (previous === undefined) delete process.env.WRAPPER_WRAPPED;
      else process.env.WRAPPER_WRAPPED = previous;
    }
    expect(code).toBe(2);
  });

  test("writes a bell inside a wrapped terminal", async () => {
    const previous = process.env.WRAPPER_WRAPPED;
    process.env.WRAPPER_WRAPPED = "1";
    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      await runNotify();
    } finally {
      process.stdout.write = originalWrite;
      if (previous === undefined) delete process.env.WRAPPER_WRAPPED;
      else process.env.WRAPPER_WRAPPED = previous;
    }
    expect(chunks.join("")).toBe("\x07");
  });
});
