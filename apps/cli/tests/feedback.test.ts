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
    ).toBe("● host • ABC123 • p2p x2 | s share • u unshare • ? status");
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
    expect(formatControlsHint("host")).toContain("s share");
    expect(formatControlsHint("viewer")).toContain("d detach");
  });
});
