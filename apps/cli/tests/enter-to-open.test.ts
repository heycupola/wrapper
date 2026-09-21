import { describe, expect, test } from "bun:test";
import { createEnterToOpen } from "../util/enter-to-open";

function newInterceptor() {
  const opened: string[] = [];
  const results: boolean[] = [];
  const interceptor = createEnterToOpen({
    open: (url) => {
      opened.push(url);
      return url !== "fail://x";
    },
    onOpened: (ok) => results.push(ok),
  });
  return { interceptor, opened, results };
}

describe("createEnterToOpen", () => {
  test("passes bytes through until armed", () => {
    const { interceptor, opened } = newInterceptor();
    expect(interceptor.process("hello\r")).toBe("hello\r");
    expect(opened).toEqual([]);
    expect(interceptor.pending).toBe(false);
  });

  test("Enter opens the URL and swallows the key", () => {
    const { interceptor, opened, results } = newInterceptor();
    interceptor.arm("https://checkout.stripe.com/c/pay/cs_test");
    expect(interceptor.pending).toBe(true);
    expect(interceptor.process("\r")).toBe("");
    expect(opened).toEqual(["https://checkout.stripe.com/c/pay/cs_test"]);
    expect(results).toEqual([true]);
    expect(interceptor.pending).toBe(false);
  });

  test("swallows a CRLF pair as a single Enter", () => {
    const { interceptor, opened } = newInterceptor();
    interceptor.arm("https://example.com/pay");
    expect(interceptor.process("\r\nls\n")).toBe("ls\n");
    expect(opened).toEqual(["https://example.com/pay"]);
    expect(interceptor.pending).toBe(false);
  });

  test("any other key cancels without opening", () => {
    const { interceptor, opened } = newInterceptor();
    interceptor.arm("https://example.com/pay");
    expect(interceptor.process("ls\r")).toBe("ls\r");
    expect(opened).toEqual([]);
    expect(interceptor.pending).toBe(false);
  });

  test("a later Enter is not stolen after cancel", () => {
    const { interceptor, opened } = newInterceptor();
    interceptor.arm("https://example.com/pay");
    expect(interceptor.process("a")).toBe("a");
    expect(interceptor.process("\r")).toBe("\r");
    expect(opened).toEqual([]);
  });

  test("disarm drops a pending open", () => {
    const { interceptor, opened } = newInterceptor();
    interceptor.arm("https://example.com/pay");
    interceptor.disarm();
    expect(interceptor.process("\r")).toBe("\r");
    expect(opened).toEqual([]);
  });

  test("failed open still swallows Enter", () => {
    const { interceptor, opened, results } = newInterceptor();
    interceptor.arm("fail://x");
    expect(interceptor.process("\n")).toBe("");
    expect(opened).toEqual(["fail://x"]);
    expect(results).toEqual([false]);
  });
});
