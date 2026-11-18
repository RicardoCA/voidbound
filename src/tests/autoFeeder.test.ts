import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { feedAutomatically, loadFeeder } from "../survival/autoFeeder";
import { spoilMeat } from "../survival/perishables";
import { migrateSave } from "../persistence/migrations";
import type { Inventory } from "../game/types";

function game() {
  setActivePinia(createPinia());
  return useGame();
}
describe("alimentador do traje", () => {
  it("equipa sem duplicar e exige reserva vazia para desequipar", () => {
    const g = game();
    g.state.backpack = { autoFeeder: 1, cookedMeat: 5 };
    g.toggleFeeder();
    expect(g.state.backpack.autoFeeder).toBeUndefined();
    expect(g.state.player.autoFeeder).toEqual({ food: {} });
    g.moveFeeder("cookedMeat", 5, true);
    g.toggleFeeder();
    expect(g.state.player.autoFeeder?.food.cookedMeat).toBe(5);
    expect(g.state.backpack.autoFeeder).toBeUndefined();
    g.moveFeeder("cookedMeat", 5, false);
    g.toggleFeeder();
    expect(g.state.player.autoFeeder).toBeUndefined();
    expect(g.state.backpack).toEqual({ autoFeeder: 1, cookedMeat: 5 });
  });
  it("aceita até 100 unidades de um único alimento sem perder excedentes", () => {
    const source: Inventory = { cookedMeat: 101, basaltBerry: 5 },
      reserve: Inventory = {};
    expect(loadFeeder(source, reserve, "cookedMeat", 100)).toBe(true);
    expect(loadFeeder(source, reserve, "cookedMeat", 1)).toBe(false);
    expect(loadFeeder(source, reserve, "basaltBerry", 1)).toBe(false);
    expect(source).toEqual({ cookedMeat: 1, basaltBerry: 5 });
    expect(reserve).toEqual({ cookedMeat: 100 });
  });
  it("só ativa abaixo de 30 e consome apenas o necessário", () => {
    const p = game().state.player;
    p.autoFeeder = { food: { cookedMeat: 10 } };
    p.hunger = 30;
    expect(feedAutomatically(p)).toBe(0);
    p.hunger = 29;
    expect(feedAutomatically(p)).toBe(3);
    expect(p.hunger).toBe(100);
    expect(p.autoFeeder.food.cookedMeat).toBe(7);
    p.hunger = 0;
    p.autoFeeder.food = { basaltBerry: 2 };
    expect(feedAutomatically(p)).toBe(2);
    expect(p.hunger).toBe(36);
  });
  it("preserva validade, intoxicação e o equipamento no save", () => {
    const g = game(),
      p = g.state.player;
    p.autoFeeder = { food: {} };
    const source: Inventory = {
      rawMeat: 2,
      meatBatches: [{ amount: 2, expires: 20 }],
    };
    expect(loadFeeder(source, p.autoFeeder.food, "rawMeat", 2)).toBe(true);
    const saved = migrateSave(JSON.parse(JSON.stringify(g.state)));
    expect(saved.player.autoFeeder).toEqual(p.autoFeeder);
    p.hunger = 29;
    expect(feedAutomatically(p, () => 0)).toBe(2);
    expect(p.sickness).toBe(30);
    saved.time = 21;
    expect(spoilMeat(saved)).toBe(2);
    expect(saved.player.autoFeeder?.food.rawMeat).toBeUndefined();
  });
});
