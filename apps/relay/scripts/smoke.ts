const relayUrl = process.env.RELAY_URL ?? process.env.WRAPPER_RELAY_URL;
if (!relayUrl) {
  throw new Error("Missing RELAY_URL (or WRAPPER_RELAY_URL) for smoke check.");
}

const normalized = normalizeBaseHttpUrl(relayUrl);
const healthUrl = `${normalized}/healthz`;

const healthResp = await fetch(healthUrl);
if (!healthResp.ok) {
  throw new Error(`Relay health check failed: ${healthResp.status} ${healthResp.statusText}`);
}

const json = (await healthResp.json()) as {
  ok?: boolean;
  service?: string;
};
if (json.ok !== true || json.service !== "relay") {
  throw new Error(`Unexpected health payload: ${JSON.stringify(json)}`);
}

const wsUrl = buildWsUrl(relayUrl);
const wsResult = await expectUnauthorizedWs(wsUrl);

process.stdout.write(
  [
    "Relay smoke check passed.",
    `healthz: ${healthUrl}`,
    `unauthorized closeCode: ${wsResult.code}`,
  ].join("\n") + "\n",
);

function normalizeBaseHttpUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  if (!url.pathname || url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/+$/, "");
}

function buildWsUrl(base: string): string {
  const url = new URL(base);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}

function expectUnauthorizedWs(url: string): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // no-op
      }
      reject(new Error("WebSocket smoke check timed out waiting for close event."));
    }, 10_000);

    ws.addEventListener("close", (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (![4001, 4003].includes(event.code)) {
        reject(
          new Error(
            `Expected unauthorized close code (4001/4003), got ${event.code} (${event.reason})`,
          ),
        );
        return;
      }
      resolve({ code: event.code, reason: event.reason });
    });

    ws.addEventListener("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error("WebSocket connection error during smoke check."));
    });
  });
}
