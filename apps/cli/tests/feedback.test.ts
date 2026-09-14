import { describe, expect, test } from "bun:test";
import { formatControlsHint, formatSessionHud } from "../util/feedback";

describe("session HUD", () => {
  test("formats persistent host state", () => {
    expect(
      formatSessionHud({
        role: "host",
        sessionTag: "ABC123",
        transport: "local",
      }),
    ).toBe("wrapper • host • ABC123 • local");
  });

  test("formats host prefix controls with P2P peer count", () => {
    expect(
      formatSessionHud({
        role: "host",
        sessionTag: "ABC123",
        transport: "p2p",
        p2pPeerCount: 2,
        armed: true,
      }),
    ).toBe("● host • ABC123 • p2p x2 | s share • u unshare • w typing • ? status");
  });

  test("shows watch-only access while shared", () => {
    expect(
      formatSessionHud({
        role: "host",
        sessionTag: "ABC123",
        transport: "relay",
        guestAccess: "view",
      }),
    ).toBe("wrapper • host • ABC123 • relay • view");
  });

  test("formats sharing transport while share is in flight", () => {
    expect(
      formatSessionHud({
        role: "host",
        sessionTag: "ABC123",
        transport: "sharing",
      }),
    ).toBe("wrapper • host • ABC123 • sharing");
  });

  test("formats viewer prefix controls", () => {
    expect(
      formatSessionHud({
        role: "viewer",
        sessionTag: "XYZ789",
        transport: "relay",
        armed: true,
      }),
    ).toBe("● viewer • XYZ789 • relay | d detach • ? status");
  });

  test("provides discoverability hints for both roles", () => {
    expect(formatControlsHint("host")).toContain("Ctrl+\\");
    expect(formatControlsHint("host", "Ctrl+G")).toContain("Ctrl+G");
    expect(formatControlsHint("host")).toContain("w typing");
    expect(formatControlsHint("viewer")).toContain("d detach");
  });
});
