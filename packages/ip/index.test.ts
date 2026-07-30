import { describe, expect, test } from "bun:test";
import ip from "./index.cjs";

describe("safe ip compatibility shim", () => {
  test("detects loopback without treating public addresses as private", () => {
    expect(ip.isLoopback("127.0.0.1")).toBe(true);
    expect(ip.isLoopback("::1")).toBe(true);
    expect(ip.isLoopback("8.8.8.8")).toBe(false);
    expect(ip.isPublic("8.8.8.8")).toBe(true);
    expect(ip.isPrivate("10.0.0.1")).toBe(true);
  });

  test("round-trips IPv4 and IPv6 STUN addresses", () => {
    expect(ip.toString(ip.toBuffer("192.0.2.10"))).toBe("192.0.2.10");
    expect(ip.toString(ip.toBuffer("2001:db8::1"))).toBe("2001:db8::1");
  });

  test("supports caller-provided output buffers", () => {
    const output = Buffer.alloc(8);
    expect(ip.toBuffer("203.0.113.7", output, 2)).toBe(output);
    expect([...output.subarray(2, 6)]).toEqual([203, 0, 113, 7]);
  });
});
