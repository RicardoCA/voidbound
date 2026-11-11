import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it } from "vitest";
import { activateShip, buyShip } from "../fleet/hangar";
import {
  buyShipBlueprint,
  craftSpecialShip,
  shipBlueprints,
} from "../fleet/shipBlueprints";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";

it("vende projetos e fabrica naves apenas nas oficinas correspondentes", async () => {
  setActivePinia(createPinia());
  const s = useGame().state;
  s.mode = "docked";
  s.credits = 1_000_000;
  expect(buyShip(s, "lumen")).toBeTruthy();
  expect(buyShipBlueprint(s, "corvus")).toBeTruthy();
  expect(buyShipBlueprint(s, "lumen")).toBeUndefined();
  expect(buyShipBlueprint(s, "lumen")).toBeTruthy();
  expect(s.credits).toBe(945_000);
  expect(craftSpecialShip(s, "lumen")).toBeTruthy();
  expect(s.parkedShips).toHaveLength(0);
  s.inventory = { ...shipBlueprints.lumen.materials, iron: 3 };
  s.systemX = 1;
  expect(craftSpecialShip(s, "lumen")).toBeTruthy();
  expect(s.inventory.plate).toBe(280);
  expect(buyShipBlueprint(s, "corvus")).toBeUndefined();
  s.systemX = 0;
  expect(craftSpecialShip(s, "lumen")).toBeUndefined();
  expect(s.inventory).toEqual({ iron: 3 });
  expect(s.parkedShips[0]?.model).toBe("lumen");
  expect(activateShip(s, s.parkedShips[0].id)).toBeUndefined();

  const db = new SaveDatabase(`ship-blueprints-${crypto.randomUUID()}`);
  try {
    await db.write(s);
    const saved = await db.read();
    expect(saved?.shipBlueprints).toEqual(["lumen", "corvus"]);
    expect(saved?.activeShip.model).toBe("lumen");
  } finally {
    await db.delete();
  }
});
