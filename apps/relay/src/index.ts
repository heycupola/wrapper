import type { ServerWebSocket } from "bun";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Hono } from "hono";
import { RelayHub, type RelayRole } from "./hub";
import { createLogger } from "./logger";

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
  authorized: boolean;
  pending: Array<string | ArrayBuffer | Uint8Array>;
};

// Cap frames buffered before authorization completes so a misbehaving or
// malicious client cannot use the pre-auth window to exhaust memory.
const MAX_PENDING_FRAMES = 32;

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
        data: { ticket, authorized: false, pending: [] },
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
      if (
        typeof raw !== "string" &&
        !(raw instanceof ArrayBuffer) &&
        !(raw instanceof Uint8Array)
      ) {
        return;
      }

      // Authorization is an async Convex round-trip. Frames can arrive before
      // it completes (the host bridge sends `session.opened` immediately on
      // open), so buffer them and flush in order once the socket is bound,
      // instead of dropping the socket as "unbound".
      if (!ws.data.authorized) {
        if (ws.data.pending.length >= MAX_PENDING_FRAMES) {
          ws.close(4003, "too many pre-auth messages");
          return;
        }
        ws.data.pending.push(raw);
        return;
      }

      hub.routeInbound(ws, raw);
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
    // The socket may have closed while the ticket round-trip was in flight.
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.data.role = consumed.role;
    ws.data.sessionId = consumed.sessionId;
    ws.data.userId = consumed.userId;
    hub.bind({
      peer: ws,
      role: consumed.role,
      sessionId: consumed.sessionId,
    });
    ws.data.authorized = true;
    // Flush any frames buffered during authorization, in arrival order.
    const pending = ws.data.pending;
    ws.data.pending = [];
    for (const frame of pending) {
      hub.routeInbound(ws, frame);
    }
    log.debug("socket authorized", {
      role: consumed.role,
      sessionId: consumed.sessionId,
      flushed: pending.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn("ticket rejected", { error: err.message });
    ws.data.pending = [];
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
