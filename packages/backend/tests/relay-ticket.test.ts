import { describe, expect, test } from "bun:test";
import {
  createRelayTicket,
  getRelayTicketConfig,
  hashRelayTicket,
} from "../convex/lib/relayTicket";

describe("relay ticket config", () => {
  test("uses defaults", () => {
    const config = getRelayTicketConfig({});
    expect(config.hostTtlMs).toBe(30_000);
    expect(config.viewerTtlMs).toBe(60_000);
  });

  test("uses custom env values", () => {
    const config = getRelayTicketConfig({
      WRAPPER_RELAY_HOST_TICKET_TTL_MS: "45000",
      WRAPPER_RELAY_VIEWER_TICKET_TTL_MS: "90000",
    });
    expect(config.hostTtlMs).toBe(45_000);
    expect(config.viewerTtlMs).toBe(90_000);
  });

  test("falls back on invalid env values", () => {
    const config = getRelayTicketConfig({
      WRAPPER_RELAY_HOST_TICKET_TTL_MS: "x",
      WRAPPER_RELAY_VIEWER_TICKET_TTL_MS: "0",
    });
    expect(config.hostTtlMs).toBe(30_000);
    expect(config.viewerTtlMs).toBe(60_000);
  });
});

describe("relay ticket primitives", () => {
  test("createRelayTicket returns hex token", () => {
    const ticket = createRelayTicket();
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
  });

  test("hashRelayTicket is deterministic", async () => {
    const first = await hashRelayTicket("ticket-value");
    const second = await hashRelayTicket("ticket-value");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
