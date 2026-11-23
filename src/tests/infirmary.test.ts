import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it, vi } from "vitest";
import { placePiece, settlementFor } from "../construction/building";
import { INFIRMARY_ENERGY, treatAtInfirmary } from "../construction/infirmary";
import { PLANET_DAY } from "../construction/habitat";
import { Terrain } from "../game/procedural/terrain";
import { useConstruction } from "../stores/construction";
import { useGame } from "../stores/game";

function setup() {
  setActivePinia(createPinia());
  const g = useGame();
  g.newGame("infirmary");
  g.state.mode = "surface";
  Object.assign(g.state.player, { x: 128, y: 456, health: 45, sickness: 10 });
  const data = settlementFor(g.state, g.planet.id);
  const terrain = new Terrain(g.planet, {});
  vi.spyOn(terrain, "getAt").mockImplementation((_x, y) => y >= 29 ? 1 : 0);
  return { g, data, terrain };
}

it("fabrica os suprimentos e a câmara na bancada e instala a câmara em dois blocos", () => {
  const { g, data, terrain } = setup();
  g.enter();
  g.state.inventory = { plate: 5, circuit: 2, silicon: 4, carbon: 1, fiber: 2 };
  g.make("infirmary");
  g.make("medicalSupplies");
  expect(g.state.inventory).toEqual({ infirmary: 1, medicalSupplies: 1 });
  g.state.mode = "surface";
  g.state.backpack = { ...g.state.inventory };
  expect(placePiece({
    inventory: g.state.backpack, terrain, settlement: data, landingX: -10, capacity: 24, player: g.state.player,
  }, "infirmary", 5, 28)).toBeUndefined();
  const b = useConstruction();
  expect(b.interactAt(6, 28)).toBe(true);
  expect(g.panel).toBe("infirmary");
  expect(b.infirmary?.supplies).toBe(1);
});

it("trata com sol direto ou bateria e preserva suprimentos e carga em operações recusadas", () => {
  const { g, data, terrain } = setup();
  data.pieces["5,28"] = { kind: "infirmary", facing: 1 };
  data.pieces["3,28"] = { kind: "solarPanel", facing: 1 };
  g.state.backpack.medicalSupplies = 2;
  g.state.time = PLANET_DAY / 2;
  const treat = () => treatAtInfirmary(terrain, data, g.state, "5,28");
  expect(treat()).toContain("Sem energia");
  expect(g.state.backpack.medicalSupplies).toBe(2);
  g.state.time = 0;
  expect(treat()).toBeUndefined();
  expect(g.state.player.health).toBe(85);
  expect(g.state.player.sickness).toBeUndefined();
  g.state.time = PLANET_DAY / 2;
  const battery = data.pieces["4,28"] = { kind: "battery", facing: 1, energy: INFIRMARY_ENERGY + 1 };
  expect(treat()).toBeUndefined();
  expect(g.state.player.health).toBe(100);
  expect(g.state.backpack.medicalSupplies).toBeUndefined();
  expect(battery.energy).toBe(1);
  expect(treat()).toContain("Nenhum tratamento");
  g.state.player.sickness = 3;
  expect(treat()).toContain("Faltam suprimentos");
  expect(g.state.player.sickness).toBe(3);
  expect(battery.energy).toBe(1);
});
