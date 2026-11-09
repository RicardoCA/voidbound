import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { SpaceCombat } from "../combat/flight";
import { hitNpc, salvage, sellContraband, trafficFor } from "../combat/traffic";
import {
  contractOffers,
  acceptContract,
  claimContract,
} from "../progression/contracts";
import { SaveDatabase } from "../persistence/database";
import { migrateSave } from "../persistence/migrations";
import { stationServicesFor } from "../game/station/services";
import { useGame } from "../stores/game";

describe("pirataria espacial", () => {
  it("dispara projéteis, derruba escudos e deixa um único destroço", () => {
    setActivePinia(createPinia());
    const g = useGame(),
      s = g.state;
    const flight = new SpaceCombat();
    flight.reset(s, g.system);
    const cargo = flight.npcs.find((npc) => npc.role === "freighter")!;
    Object.assign(s.ship, { x: cargo.x - 80, y: cargo.y });
    const shield = cargo.shield;
    for (let step = 0; step < 300 && cargo.hull > 0; step++) {
      s.time += 0.016;
      flight.fire(s);
      flight.update(s, g.system, 0.016);
    }
    expect(shield).toBeGreaterThan(0);
    expect(cargo.shield).toBe(0);
    expect(cargo.hull).toBe(0);
    expect(
      s.progression.piracy.wrecks[cargo.id]?.cargo.sealedCargo,
    ).toBeGreaterThan(0);
    expect(
      trafficFor(g.system, s.progression.piracy).some(
        (npc) => npc.id === cargo.id,
      ),
    ).toBe(false);
  });

  it("separa as naves, danifica ambos os cascos e registra destroço no impacto fatal", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    const flight = new SpaceCombat();
    flight.reset(s, g.system);
    const npc = flight.npcs.find((ship) => ship.role === "freighter")!;
    const originalHull = npc.hull;
    Object.assign(s.ship, {
      x: npc.x - 35,
      y: npc.y,
      angle: 0,
      vx: 120,
      vy: 0,
    });

    const first = flight.update(s, g.system, 0.016);
    expect(first.impacts).toHaveLength(1);
    expect(first.crimeReported).toBe(false);
    expect(s.ship.hull).toBeLessThan(100);
    expect(npc.hull).toBeLessThan(originalHull);
    expect(npc.shield).toBe(12);
    expect(npc.vx).toBeGreaterThan(s.ship.vx);
    expect(flight.update(s, g.system, 0.016).impacts).toHaveLength(0);

    s.time += 1;
    s.ship.hull = npc.hull = 1;
    Object.assign(s.ship, { x: npc.x - 35, y: npc.y, vx: 120, vy: 0 });
    expect(flight.update(s, g.system, 0.016)).toMatchObject({
      destroyed: true,
      playerDisabled: true,
    });
    expect(s.progression.piracy.wrecks[npc.id]).toBeDefined();
    expect(s.ship.hull).toBe(0);
  });

  it("exige proximidade, espaço e frenagem para saquear e não duplica após reload", async () => {
    setActivePinia(createPinia());
    const g = useGame(),
      s = g.state;
    const target = trafficFor(g.system, s.progression.piracy)[0]!;
    const wreck = hitNpc(s, g.system, target, 500)!;
    expect(hitNpc(s, g.system, target, 500)).toBeUndefined();
    expect(salvage(s, wreck, 24)).toBeTruthy();
    Object.assign(s.ship, { x: wreck.x, y: wreck.y, vx: 51 });
    expect(salvage(s, wreck, 24)).toBeTruthy();
    s.ship.vx = 0;
    expect(salvage(s, wreck, 0)).toBeTruthy();
    expect(salvage(s, wreck, 24)).toBeUndefined();
    const cargo = s.inventory.sealedCargo!;
    expect(s.progression.careers.pirate.xp).toBe(160);
    const db = new SaveDatabase(`piracy-${crypto.randomUUID()}`);
    try {
      await db.write(s);
      const restored = (await db.read())!;
      expect(salvage(restored, wreck, 24)).toBeTruthy();
      restored.mode = "docked";
      expect(sellContraband(restored, cargo)).toBeTruthy();
      expect(restored.inventory.sealedCargo).toBe(cargo);
      restored.systemX = 1;
      expect(sellContraband(restored, cargo + 1)).toBeTruthy();
      expect(sellContraband(restored, cargo)).toBeUndefined();
      expect(sellContraband(restored, cargo)).toBeTruthy();
      expect(restored.credits).toBeGreaterThan(500);
      expect(restored.progression.piracy.sold).toBe(cargo);
    } finally {
      await db.delete();
    }
  });

  it("paga um contrato clandestino apenas uma vez", () => {
    setActivePinia(createPinia());
    const g = useGame(),
      s = g.state;
    s.mode = "docked";
    const origin = g.system.station!.id;
    expect(g.system.station?.kind).toBe("standard");
    expect(
      contractOffers(s, g.system).map((contract) => contract.career),
    ).toEqual(["miner", "explorer"]);
    expect(contractOffers(s, g.system).some((c) => c.career === "pirate")).toBe(
      false,
    );
    expect(
      stationServicesFor(false).some(
        (service) => service.id === "black-market",
      ),
    ).toBe(false);
    s.systemX = 1;
    expect(g.system.station?.kind).toBe("clandestine");
    expect(
      contractOffers(s, g.system).map((contract) => contract.career),
    ).toEqual(["pirate"]);
    expect(stationServicesFor(true).map((service) => service.id)).toEqual([
      "airlock",
      "hangar",
      "workshop",
      "fuel",
      "contracts",
      "law",
      "black-market",
    ]);
    expect(
      stationServicesFor(true).some((service) => service.id === "black-market"),
    ).toBe(true);
    const station = g.system.station!.id;
    const offer = contractOffers(s, g.system).find(
      (c) => c.career === "pirate",
    )!;
    expect(acceptContract(s, station, offer.id)).toBeUndefined();
    expect(claimContract(s, station, offer.id)).toBeTruthy();
    s.inventory.sealedCargo = 4;
    expect(claimContract(s, station, offer.id)).toBeUndefined();
    expect(claimContract(s, station, offer.id)).toBeTruthy();
    expect(s.credits).toBe(5500);
    expect(s.progression.careers.pirate.xp).toBe(250);

    const legacy = {
      ...s,
      progression: {
        ...s.progression,
        contracts: {
          [offer.id]: {
            ...s.progression.contracts[offer.id]!,
            status: "ACTIVE" as const,
            stationId: origin,
            sector: { x: 0, y: 0 },
          },
        },
      },
    };
    const restored = migrateSave(legacy);
    expect(restored.progression.contracts[offer.id]).toMatchObject({
      stationId: station,
      sector: { x: 1, y: 0 },
      status: "ACTIVE",
    });
  });
});
