import type { ServerWebSocket } from "bun";
import { createLogger } from "@repo/logger";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Hono } from "hono";
import { RelayHub, type RelayRole } from "./hub";

type ConsumeTicketArgs = {
  ticket: string;
};

type ConsumeTicketResponse = {
  sessionId: string;
  role: RelayRole;
  userId: string;
  expiresAt: number;
};

type WsData = {
  ticket: string | null;
  sessionId?: string;
  role?: RelayRole;
  userId?: string;
};

const log = createLogger("relay");
const app = new Hono();
const convexClient = new ConvexHttpClient(resolveConvexUrl());
const hub = new RelayHub({
  debug: (message, data) => log.debug(message, data),
  warn: (message, data) => log.warn(message, data),
});
const sockets = new Set<ServerWebSocket<WsData>>();

const consumeTicketRef = makeFunctionReference<
  "mutation",
  ConsumeTicketArgs,
  ConsumeTicketResponse
>("relay:consumeTicket");

app.get("/healthz", (c) =>
  c.json({
    ok: true,
    service: "relay",
    uptimeSec: Math.floor(process.uptime()),
  }),
);

const port = Number.parseInt(process.env.PORT ?? "8080", 10);

const server = Bun.serve<WsData>({
  port,
  fetch(req, serverInstance) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const ticket = url.searchParams.get("ticket");
      const upgraded = serverInstance.upgrade(req, {
        data: { ticket },
      });
      if (upgraded) return undefined;
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
      void authorizeSocket(ws);
    },
    message(ws, raw) {
      if (typeof raw === "string") {
        hub.routeInbound(ws, raw);
        return;
      }
      if (raw instanceof ArrayBuffer || raw instanceof Uint8Array) {
        hub.routeInbound(ws, raw);
      }
    },
    close(ws) {
      sockets.delete(ws);
      hub.unbind(ws);
    },
  },
});

const PING_INTERVAL_MS = 25_000;
const pinger = setInterval(() => {
  for (const ws of sockets) {
    try {
      ws.ping();
    } catch {
      // Socket may have already closed.
    }
  }
}, PING_INTERVAL_MS);
pinger.unref();

log.info("relay listening", { port: server.port });

async function authorizeSocket(ws: ServerWebSocket<WsData>): Promise<void> {
  const ticket = ws.data.ticket;
  if (!ticket) {
    ws.close(4001, "missing ticket");
    return;
  }

  try {
    const consumed = await convexClient.mutation(consumeTicketRef, { ticket });
    ws.data.role = consumed.role;
    ws.data.sessionId = consumed.sessionId;
    ws.data.userId = consumed.userId;
    hub.bind({
      peer: ws,
      role: consumed.role,
      sessionId: consumed.sessionId,
    });
    log.debug("socket authorized", {
      role: consumed.role,
      sessionId: consumed.sessionId,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn("ticket rejected", { error: err.message });
    ws.close(4003, "unauthorized");
  }
}

function resolveConvexUrl(): string {
  const value =
    process.env.RELAY_CONVEX_URL ?? process.env.WRAPPER_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!value) {
    throw new Error("Missing Convex URL. Set RELAY_CONVEX_URL, WRAPPER_CONVEX_URL, or CONVEX_URL.");
  }
  return value.trim().replace(/\/+$/, "");
}
