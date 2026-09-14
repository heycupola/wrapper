import http2 from "node:http2";
import { describe, expect, test } from "bun:test";
import { postApnsHttp2 } from "../convex/lib/apnsHttp2";

describe("APNs HTTP/2 post", () => {
  test("sends the request over HTTP/2", async () => {
    const received: { method?: string; path?: string; topic?: string; body: string } = {
      body: "",
    };
    const server = http2.createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.on("stream", (stream, headers) => {
        received.method = String(headers[":method"] ?? "");
        received.path = String(headers[":path"] ?? "");
        received.topic = String(headers["apns-topic"] ?? "");
        stream.on("data", (chunk) => {
          received.body += chunk.toString("utf8");
        });
        stream.on("end", () => {
          stream.respond({ ":status": 200 });
          stream.end();
        });
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          reject(new Error("expected tcp address"));
          return;
        }
        resolve(address.port);
      });
    });

    try {
      const status = await postApnsHttp2({
        host: `127.0.0.1:${port}`,
        path: "/3/device/token",
        headers: { "apns-topic": "sh.wrapper.mobile" },
        body: JSON.stringify({ aps: { alert: "hi" } }),
        useTls: false,
      });
      expect(status).toBe(200);
      expect(received.method).toBe("POST");
      expect(received.path).toBe("/3/device/token");
      expect(received.topic).toBe("sh.wrapper.mobile");
      expect(received.body).toContain("hi");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
