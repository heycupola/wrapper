import { describe, expect, test } from "bun:test";
import { DataChannelTransport, decodeDataChannelPayload } from "../transport/webrtc-helpers";

describe("WebRTC data channel helpers", () => {
  test("sends only while open and closes the peer", () => {
    const sent: string[] = [];
    let closes = 0;
    const transport = new DataChannelTransport(
      {
        readyState: "connecting",
        send: (frame) => sent.push(frame),
      },
      () => {
        closes += 1;
      },
      false,
    );

    transport.send("before-open");
    transport.markOpen(true);
    transport.send("open-frame");
    transport.close();
    transport.send("after-close");

    expect(sent).toEqual(["open-frame"]);
    expect(transport.isOpen).toBe(false);
    expect(closes).toBe(1);
  });

  test("does not surface channel send failures", () => {
    const transport = new DataChannelTransport(
      {
        readyState: "open",
        send: () => {
          throw new Error("channel closed concurrently");
        },
      },
      () => {},
      true,
    );

    expect(() => transport.send("frame")).not.toThrow();
  });

  test("preserves text and binary frames and decodes typed-array views", () => {
    expect(decodeDataChannelPayload("json-frame")).toBe("json-frame");

    const binary = new Uint8Array([1, 2, 3]).buffer;
    expect(decodeDataChannelPayload(binary)).toBe(binary);

    const backing = new TextEncoder().encode('ignore:{"type":"attach"}:ignore');
    const start = "ignore:".length;
    const end = backing.length - ":ignore".length;
    expect(decodeDataChannelPayload(backing.subarray(start, end))).toBe('{"type":"attach"}');
    expect(decodeDataChannelPayload({ data: "unsupported" })).toBeNull();
  });
});
