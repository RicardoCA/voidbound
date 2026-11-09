import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import {
  buyScannerBlueprint,
  scannerContacts,
  shipScanners,
} from "../combat/shipScanners";
import { trafficFor } from "../combat/traffic";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";

describe("scanners de naves", () => {
  it("restringe os projetos por estação e persiste os scanners instalados", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    s.mode = "docked";
    s.credits = 50_000;
    s.inventory = { ...shipScanners.wantedScanner.cost };
    g.make("wantedScanner");
    expect(s.inventory.wantedScanner).toBeUndefined();
    expect(buyScannerBlueprint(s, "cargoScanner")).toBeTruthy();
    expect(buyScannerBlueprint(s, "wantedScanner")).toBeUndefined();
    expect(buyScannerBlueprint(s, "wantedScanner")).toBeTruthy();
    g.make("wantedScanner");
    g.use("wantedScanner");
    s.systemX = 1;
    expect(buyScannerBlueprint(s, "wantedScanner")).toBeTruthy();
    expect(buyScannerBlueprint(s, "cargoScanner")).toBeUndefined();
    expect(s.credits).toBe(20_000);
    s.inventory = { ...shipScanners.cargoScanner.cost };
    g.make("cargoScanner");
    g.use("cargoScanner");

    const db = new SaveDatabase(`scanners-${crypto.randomUUID()}`);
    try {
      await db.write(s);
      const saved = await db.read();
      expect(saved?.scannerBlueprints).toEqual([
        "wantedScanner",
        "cargoScanner",
      ]);
      expect(saved?.upgrades).toEqual(["wantedScanner", "cargoScanner"]);
    } finally {
      await db.delete();
    }
  });

  it("distingue alvos vivos e seus dados, filtrando contatos fora do alcance", () => {
    setActivePinia(createPinia());
    const g = useGame();
    g.state.systemX = 1;
    const npcs = trafficFor(g.system, g.state.progression.piracy);
    const pirate = npcs.find((npc) => npc.role === "pirate")!;
    const freighter = npcs.find((npc) => npc.role === "freighter")!;
    const ship = g.state.ship;
    ship.x = pirate.x;
    ship.y = pirate.y;
    const closeFreighter = { ...freighter, x: ship.x + 500, y: ship.y };
    const contacts = scannerContacts(ship, [closeFreighter, pirate]);
    expect(contacts.map((contact) => contact.id)).toEqual([
      pirate.id,
      freighter.id,
    ]);
    expect(contacts[0]?.wanted).toBeGreaterThan(0);
    expect(contacts[1]).toMatchObject({ wanted: 0, cargo: freighter.cargo });
    expect(
      scannerContacts(ship, [
        { ...pirate, hull: 0 },
        { ...closeFreighter, x: ship.x + 601 },
      ]),
    ).toEqual([]);
  });
});
