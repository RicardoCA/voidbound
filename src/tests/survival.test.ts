import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { emptySettlement, settlementFor } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import { fruitsNear, Wildlife } from "../survival/wildlife";
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
    g.state.inventory = { rawMeat: 1, cookedMeat: 1, basaltBerry: 1 };
    const roll = vi.spyOn(Math, "random").mockReturnValue(0.99);
    g.use("rawMeat");
    roll.mockRestore();
    expect(g.state.player.hunger).toBe(8);
    g.use("cookedMeat");
    g.use("basaltBerry");
    expect(g.state.player.hunger).toBe(61);
    expect(g.state.inventory).toEqual({});
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
    g.state.inventory = { rawMeat: 1 };
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
      expect(g.state.inventory).toEqual({ rawMeat: 1 });
      vi.advanceTimersByTime(1);
      expect(g.state.inventory).toEqual({ cookedMeat: 1 });
      g.state.inventory.rawMeat = 1;
      construction.cookMeat();
      vi.advanceTimersByTime(5_000);
      g.panel = "";
      vi.advanceTimersByTime(10_000);
      expect(g.state.inventory).toEqual({ cookedMeat: 1, rawMeat: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

it("carne crua pode intoxicar por 30 segundos, frutas e carne assada não", () => {
  const g = surface();
  g.state.player.hunger = 10;
  g.state.inventory = { rawMeat: 1, cookedMeat: 1, basaltBerry: 1 };
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
