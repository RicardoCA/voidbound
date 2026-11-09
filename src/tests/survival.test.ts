import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { emptySettlement, settlementFor } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import { fruitsNear, Wildlife } from "../survival/wildlife";
import { meatShelfLife } from "../survival/perishables";
import { PLANET_DAY } from "../construction/habitat";
import { SaveDatabase } from "../persistence/database";
import { migrateSave } from "../persistence/migrations";

function surface() {
  setActivePinia(createPinia());
  const g = useGame();
  g.started = true;
  g.state.mode = "surface";
  return g;
}

describe("sobrevivência planetária", () => {
  it("mantém a fome de saves novos e completa a de saves anteriores", () => {
    const g = surface();
    g.state.player.hunger = 0;
    expect(migrateSave(g.state).player.hunger).toBe(0);
    const { hunger, ...player } = g.state.player;
    expect(hunger).toBe(0);
    expect(migrateSave({ ...g.state, player }).player.hunger).toBe(100);
  });

  it("causa dano com fome zerada e permite comer carne crua, assada e fruta", () => {
    const g = surface();
    g.state.player.hunger = 0;
    g.tick(1);
    expect(g.state.player.health).toBe(97);
    g.state.backpack = { rawMeat: 1, cookedMeat: 1, basaltBerry: 1 };
    const roll = vi.spyOn(Math, "random").mockReturnValue(0.99);
    g.use("rawMeat");
    roll.mockRestore();
    expect(g.state.player.hunger).toBe(8);
    g.use("cookedMeat");
    g.use("basaltBerry");
    expect(g.state.player.hunger).toBe(61);
    expect(g.state.backpack).toEqual({});
    g.tick(1);
    expect(g.state.player.health).toBe(97);
  });

  it("gera frutas distintas por bioma e respeita a coleta salva", () => {
    const g = surface();
    const kinds = new Set<string>();
    for (let kind = 0; kind < 6; kind++) {
      const planet = { ...g.planet, kind };
      const terrain = new Terrain(planet, {});
      const settlement = emptySettlement();
      const berry = fruitsNear(planet, terrain, settlement, 100, 0).find(
        (fruit) => fruit.id === "fruit:0",
      )!;
      kinds.add(berry.item);
      settlement.foraged = { [berry.id]: 180 };
      expect(
        fruitsNear(planet, terrain, settlement, 100, 179).some(
          (fruit) => fruit.id === berry.id,
        ),
      ).toBe(false);
      expect(fruitsNear(planet, terrain, settlement, 100, 180)).toContainEqual(
        berry,
      );
    }
    expect(kinds.size).toBe(6);
  });

  it("fauna pacífica não ataca, predador causa dano e respeita o retorno salvo", () => {
    const g = surface();
    const terrain = new Terrain(g.planet, {});
    const settlement = emptySettlement();
    const wildlife = new Wildlife();
    const p = g.state.player;
    p.x = 240;
    wildlife.update(g.planet, terrain, settlement, p, 0, 0.02);
    const peaceful = wildlife.animals.get("animal:0")!;
    const hostile = wildlife.animals.get("animal:1")!;
    Object.assign(p, { x: peaceful.x, y: peaceful.y });
    wildlife.update(g.planet, terrain, settlement, p, 2, 0.02);
    expect(p.health).toBe(100);
    Object.assign(p, { x: hostile.x, y: hostile.y });
    wildlife.update(g.planet, terrain, settlement, p, 2, 0.02);
    expect(p.health).toBe(91);
    settlement.hunted = { [hostile.id]: 300 };
    wildlife.update(g.planet, terrain, settlement, p, 299, 0.02);
    expect(wildlife.animals.has(hostile.id)).toBe(false);
  });

  it("assa apenas perto da fogueira e consome a carne crua uma vez", () => {
    const g = surface(),
      construction = useConstruction();
    const data = settlementFor(g.state, g.planet.id);
    g.state.backpack = { rawMeat: 1 };
    g.state.player.x = 88;
    g.state.player.y = 450;
    data.pieces["5,28"] = { kind: "campfire", facing: 1 };
    expect(construction.interactAt(5, 28)).toBe(true);
    expect(g.panel).toBe("cook");
    vi.useFakeTimers();
    try {
      construction.cookMeat();
      construction.cookMeat();
      vi.advanceTimersByTime(9_999);
      expect(g.state.backpack).toMatchObject({ rawMeat: 1 });
      vi.advanceTimersByTime(1);
      expect(g.state.backpack).toEqual({ cookedMeat: 1 });
      g.state.backpack.rawMeat = 1;
      construction.cookMeat();
      vi.advanceTimersByTime(5_000);
      g.panel = "";
      vi.advanceTimersByTime(10_000);
      expect(g.state.backpack).toMatchObject({ cookedMeat: 1, rawMeat: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

it("carne crua pode intoxicar por 30 segundos, frutas e carne assada não", () => {
  const g = surface();
  g.state.player.hunger = 10;
  g.state.backpack = { rawMeat: 1, cookedMeat: 1, basaltBerry: 1 };
  const roll = vi.spyOn(Math, "random").mockReturnValue(0);
  try {
    g.use("cookedMeat");
    g.use("basaltBerry");
    expect(g.sicknessRemaining).toBe(0);
    g.use("rawMeat");
    expect(g.sicknessRemaining).toBe(30);
  } finally {
    roll.mockRestore();
  }
  g.state.mode = "interior";
  g.tick(29);
  expect(g.state.player.health).toBe(71);
  expect(migrateSave(g.state).player.sickness).toBe(1);
  g.tick(2);
  expect(g.state.player.health).toBe(70);
  expect(g.sicknessRemaining).toBe(0);
});

describe("modo sobrevivente e inventários isolados", () => {
  it("migra a carga antiga para a nave sem copiar itens para a mochila", () => {
    const g = surface();
    g.state.inventory = { iron: 7 };
    const { backpack, ...old } = g.state;
    expect(backpack).toEqual({});
    expect(migrateSave(old)).toMatchObject({
      inventory: { iron: 7 },
      backpack: {},
    });
  });

  it("perde só a mochila ao morrer na superfície com a opção padrão", () => {
    const g = surface();
    expect(g.survivorEnabled).toBe(true);
    const cabinet = settlementFor(g.state, g.planet.id).cabinets;
    cabinet["2,28"] = { iron: 5 };
    g.state.inventory = { iron: 3 };
    g.collect("copper", 2);
    expect(g.state.backpack).toEqual({ copper: 2 });
    g.state.player.health = 0;
    g.tick(0);
    expect(g.state.mode).toBe("interior");
    expect(g.state.player.health).toBe(100);
    expect(g.state.backpack).toEqual({});
    expect(g.state.inventory).toEqual({ iron: 3 });
    expect(cabinet["2,28"]).toEqual({ iron: 5 });
  });

  it("preserva os itens ao zerar o casco com a opção desligada", () => {
    const g = surface();
    g.survivorEnabled = false;
    g.state.backpack = { copper: 2 };
    g.state.player.health = 0;
    g.tick(0);
    expect(g.state.backpack).toEqual({ copper: 2 });
    g.state.activeShip = { id: "ship-2", model: "atlas" };
    g.state.inventory = { iron: 3 };
    g.state.ship.hull = 0;
    expect(g.handleHullFailure("Resgate")).toBe(false);
    expect(g.state.ship.hull).toBe(30);
    expect(g.state.inventory).toEqual({ iron: 3 });
    expect(g.state.backpack).toEqual({ copper: 2 });
  });

  it.each([
    { id: "ship-1", model: "sparrow" },
    { id: "ship-4", model: "sparrow", rescue: true },
  ] as const)("estabiliza $id, mas esvazia a carga e a mochila", (ship) => {
    const g = surface();
    g.state.mode = "space";
    g.state.activeShip = ship;
    g.state.inventory = { iron: 3 };
    g.state.backpack = { copper: 2 };
    const cabinet = settlementFor(g.state, g.planet.id).cabinets;
    cabinet["2,28"] = { wood: 5 };
    g.state.ship.hull = 0;
    expect(g.handleHullFailure("Resgate")).toBe(false);
    expect(g.state.ship.hull).toBe(30);
    expect(g.state.activeShip).toEqual(ship);
    expect(g.state.mode).toBe("space");
    expect(g.state.inventory).toEqual({});
    expect(g.state.backpack).toEqual({});
    expect(cabinet["2,28"]).toEqual({ wood: 5 });
  });

  it("só transfere a bordo e respeita a quantidade disponível", () => {
    const g = surface();
    g.state.backpack = { copper: 2 };
    expect(g.moveCargo(true, "copper", 2)).toBe(false);
    g.enter();
    expect(g.moveCargo(true, "copper", 3)).toBe(false);
    expect(g.state.backpack).toEqual({ copper: 2 });
    expect(g.moveCargo(true, "copper", 2)).toBe(true);
    expect(g.state.inventory).toEqual({ copper: 2 });
    expect(g.moveCargo(false, "copper", 1)).toBe(true);
    expect(g.state.inventory).toEqual({ copper: 1 });
    expect(g.state.backpack).toEqual({ copper: 1 });
  });

  it("remove a nave perdida, preserva depósitos e persiste o resgate na estação", async () => {
    const g = surface();
    const { systemAt } = await import("../universe/generator");
    const noStation = Array.from({ length: 20 }, (_, i) => i + 2).find(
      (x) => !systemAt(g.state.seed, x, 0).station,
    )!;
    g.state.systemX = noStation;
    const baseId = g.planet.id;
    settlementFor(g.state, baseId).cabinets["2,28"] = { wood: 5 };
    g.state.activeShip = { id: "ship-2", model: "atlas" };
    g.state.nextShipId = 4;
    g.state.parkedShips.push({
      id: "ship-3",
      model: "sparrow",
      location: { x: 1, y: 0 },
      ship: { ...g.state.ship },
      inventory: { copper: 5 },
      upgrades: [],
    });
    g.state.mode = "space";
    g.state.inventory = { iron: 3 };
    g.state.backpack = { copper: 2 };
    g.state.upgrades = ["laser"];
    g.state.ship.hull = 0;
    expect(g.handleHullFailure("Resgate")).toBe(true);
    expect(g.handleHullFailure("Resgate")).toBe(false);
    expect(g.state).toMatchObject({
      mode: "docked",
      systemX: 0,
      systemY: 0,
      activeShip: { id: "ship-4", model: "sparrow", rescue: true },
      nextShipId: 5,
      inventory: {},
      backpack: {},
      upgrades: [],
      settlements: { [baseId]: { cabinets: { "2,28": { wood: 5 } } } },
      parkedShips: [{ id: "ship-3", inventory: { copper: 5 } }],
    });
    const db = new SaveDatabase(`rescue-${crypto.randomUUID()}`);
    try {
      await db.write(g.state);
      expect(await db.read()).toEqual(JSON.parse(JSON.stringify(g.state)));
    } finally {
      await db.delete();
    }
  });
});

describe("conservação da carne e descanso planetário", () => {
  it("mantém a validade de cada lote ao transferir, refrigerar e salvar", async () => {
    const g = surface();
    const b = useConstruction();
    const data = settlementFor(g.state, g.planet.id);
    data.pieces["4,28"] = { kind: "fridge", facing: 1 };
    data.pieces["5,28"] = { kind: "cabinet", facing: 1 };
    data.pieces["3,28"] = { kind: "battery", facing: 1, energy: 1200 };
    data.pieces["3,27"] = { kind: "solarPanel", facing: 1 };
    data.cabinets["4,28"] = {};
    data.cabinets["5,28"] = {};
    Object.assign(g.state.player, { x: 72, y: 452 });
    g.collect("rawMeat", 2);
    g.state.time = PLANET_DAY / 2;
    g.collect("rawMeat", 1);
    expect(b.interactAt(4, 28)).toBe(true);
    expect(b.moveItem("deposit", "rawMeat", 1)).toBe(true);
    expect(b.interactAt(5, 28)).toBe(true);
    expect(b.moveItem("deposit", "rawMeat", 1)).toBe(true);
    g.state.time = PLANET_DAY;
    expect(g.refreshFood()).toBe(1);
    expect(data.cabinets["5,28"]!.rawMeat).toBeUndefined();
    expect(g.state.backpack.rawMeat).toBe(1);
    g.state.time = PLANET_DAY * 4;
    expect(g.refreshFood()).toBe(1);
    expect(data.cabinets["4,28"]!.rawMeat).toBe(1);
    const db = new SaveDatabase(`fridge-${crypto.randomUUID()}`);
    try {
      await db.write(g.state);
      g.state = (await db.read())!;
      expect(b.interactAt(4, 28)).toBe(true);
      expect(b.moveItem("withdraw", "rawMeat", 1)).toBe(true);
      g.enter();
      expect(g.moveCargo(true, "rawMeat", 1)).toBe(true);
      g.state.time = PLANET_DAY * 4.5 - 0.1;
      expect(g.refreshFood()).toBe(0);
      g.state.time += 0.1;
      expect(g.refreshFood()).toBe(1);
      expect(g.state.inventory.rawMeat).toBeUndefined();
    } finally {
      await db.delete();
    }
  });

  it("refrigera com luz ou bateria próxima e volta a envelhecer sem energia", () => {
    const g = surface();
    const b = useConstruction();
    const data = settlementFor(g.state, g.planet.id);
    data.pieces["4,28"] = { kind: "fridge", facing: 1 };
    data.pieces["4,27"] = { kind: "solarPanel", facing: 1 };
    data.cabinets["4,28"] = {};
    Object.assign(g.state.player, { x: 72, y: 452 });
    g.collect("rawMeat");
    expect(b.interactAt(4, 28)).toBe(true);
    expect(b.fridgePowered).toBe(true);
    expect(b.moveItem("deposit", "rawMeat", 1)).toBe(true);
    const fresh = meatShelfLife(data.cabinets["4,28"]!, g.state.time, true);
    g.state.time += 60;
    expect(g.refreshFood()).toBe(0);
    expect(b.fridgePowered).toBe(true);
    expect(meatShelfLife(data.cabinets["4,28"]!, g.state.time, true)).toEqual(
      fresh,
    );
    g.state.time = PLANET_DAY / 2;
    g.refreshFood();
    expect(b.fridgePowered).toBe(false);
    const remaining = data.cabinets["4,28"]!.meatBatches![0]!.expires;
    expect(remaining).toBeLessThan(PLANET_DAY);
    data.pieces["5,28"] = { kind: "battery", facing: 1, energy: 3 };
    g.worldChanged();
    g.refreshFood();
    expect(b.fridgePowered).toBe(true);
    g.state.time += 2;
    g.refreshFood();
    expect(b.fridgePowered).toBe(true);
    expect(data.cabinets["4,28"]!.meatBatches![0]!.expires).toBe(remaining);
    g.state.time += 2;
    g.refreshFood();
    expect(data.pieces["5,28"]!.energy).toBe(0);
    expect(b.fridgePowered).toBe(false);
    expect(data.cabinets["4,28"]!.meatBatches![0]!.expires).toBeCloseTo(
      remaining - 1,
    );
    delete data.pieces["4,27"];
    g.worldChanged();
    g.state.time += PLANET_DAY;
    expect(g.refreshFood()).toBe(1);
    expect(data.cabinets["4,28"]!.rawMeat).toBeUndefined();
  });

  it("avança oito horas por descanso e remove carne após um dia fora da geladeira", () => {
    const g = surface();
    const b = useConstruction();
    const data = settlementFor(g.state, g.planet.id);
    data.pieces["4,28"] = { kind: "bed", facing: 1 };
    Object.assign(g.state.player, { x: 72, y: 452 });
    g.collect("rawMeat");
    for (let i = 0; i < 3; i++) {
      expect(b.interactAt(4, 28)).toBe(true);
      expect(g.panel).toBe("sleep");
      expect(b.sleep()).toBe(true);
      expect(g.state.time).toBeCloseTo(((i + 1) * PLANET_DAY) / 3);
    }
    expect(g.state.backpack.rawMeat).toBeUndefined();
  });
});

it("mostra o lote de carne mais próximo do vencimento com o relógio de cada armazenamento", () => {
  const inventory = {
    rawMeat: 2,
    meatBatches: [
      { amount: 1, expires: PLANET_DAY / 2 },
      { amount: 1, expires: PLANET_DAY },
    ],
  };
  expect(meatShelfLife(inventory, PLANET_DAY / 4)).toEqual({
    percent: 25,
    label: "6 h 00 min",
  });
  expect(meatShelfLife(inventory, PLANET_DAY * 2, true)).toEqual({
    percent: 50,
    label: "12 h 00 min",
  });
  expect(meatShelfLife(inventory, PLANET_DAY / 2)?.label).toBe("Vencida");
  expect(meatShelfLife({ rawMeat: 1 }, 5)?.label).toBe("24 h 00 min");
});
