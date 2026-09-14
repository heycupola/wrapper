"use node";

import http2 from "node:http2";

const REQUEST_TIMEOUT_MS = 10_000;

export async function postApnsHttp2(input: {
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  useTls?: boolean;
}): Promise<number> {
  const useTls = input.useTls !== false;
  const url = `${useTls ? "https" : "http"}://${input.host}`;
  return await new Promise((resolve, reject) => {
    const client = http2.connect(url);
    const fail = (error: Error): void => {
      client.close();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(new Error("APNs request timed out"));
    }, REQUEST_TIMEOUT_MS);
    timer.unref?.();
    client.on("error", (error) => fail(error instanceof Error ? error : new Error(String(error))));

    const req = client.request({
      ":method": "POST",
      ":path": input.path,
      ...input.headers,
    });
    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", () => {});
    req.on("error", (error) => fail(error instanceof Error ? error : new Error(String(error))));
    req.on("end", () => {
      clearTimeout(timer);
      client.close();
      resolve(status);
    });
    req.end(input.body);
  });
}
