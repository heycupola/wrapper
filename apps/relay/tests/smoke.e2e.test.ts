import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const RELAY_PORT = 18080;
const RELAY_URL = `http://127.0.0.1:${RELAY_PORT}`;
let relayProc: Bun.Subprocess | null = null;

beforeAll(async () => {
  relayProc = Bun.spawn({
    cmd: ["bun", "run", "src/index.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(RELAY_PORT),
      CONVEX_URL: "https://example.convex.cloud",
    },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

  await waitForHealth();
});

afterAll(async () => {
  if (!relayProc) return;
  relayProc.kill();
  await relayProc.exited;
});

describe("relay smoke e2e", () => {
  test("health endpoint returns ok payload", async () => {
    const res = await fetch(`${RELAY_URL}/healthz`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.service).toBe("relay");
  });

  test("ws endpoint rejects unauthenticated viewers", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${RELAY_PORT}/ws`);
    const closeCode = await new Promise<number>((resolve) => {
      ws.addEventListener("close", (event) => resolve(event.code), { once: true });
    });
    expect(closeCode).toBe(4001);
  });
});

async function waitForHealth(): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${RELAY_URL}/healthz`);
      if (res.ok) return;
      lastError = new Error(`healthz returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    // eslint-disable-next-line no-await-in-loop
    await Bun.sleep(100);
  }
  throw new Error(`relay test server did not become healthy: ${String(lastError)}`);
}
