import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import { SpaceCombat } from "../combat/flight";
import { hitNpc, trafficFor } from "../combat/traffic";
import { cycleWeapon, selectedWeapon, weaponModules } from "../combat/weapons";
import { activateShip, buyShip } from "../fleet/hangar";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";

describe("armamentos da nave", () => {
  it("fabrica e instala cada arma uma vez e dispara com o perfil selecionado", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    expect(selectedWeapon(s)).toBe("pulse");
    expect(cycleWeapon(s)).toBe(false);
    s.mode = "interior";

    for (const [id, weapon] of Object.entries(weaponModules)) {
      const module = id as keyof typeof weaponModules;
      s.inventory = { ...weapon.cost };
      g.make(module);
      expect(s.inventory).toEqual({ [module]: 1 });
      g.use(module);
      expect(s.inventory[module]).toBeUndefined();
      expect(s.upgrades).toContain(module);
      s.inventory[module] = 1;
      g.use(module);
      expect(s.inventory[module]).toBe(1);
      expect(cycleWeapon(s)).toBe(true);
      expect(selectedWeapon(s)).toBe(module);

      const combat = new SpaceCombat();
      s.ship.energy = weapon.energy - 1;
      expect(combat.fire(s)).toBe(false);
      s.ship.energy = 100;
      expect(combat.fire(s)).toBe(true);
      expect(s.ship.energy).toBe(100 - weapon.energy);
      expect(combat.bolts).toHaveLength(weapon.angles.length);
      expect(combat.bolts[0]?.damage).toBe(weapon.damage);
      expect(combat.fire(s)).toBe(false);
    }
    expect(cycleWeapon(s)).toBe(true);
    expect(selectedWeapon(s)).toBe("pulse");
  });

  it("salva a seleção por nave e retorna ao laser quando falta o módulo", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    s.mode = "docked";
    s.credits = 2_000_000;
    s.upgrades.push("ion");
    cycleWeapon(s);
    expect(buyShip(s, "atlas")).toBeUndefined();
    expect(activateShip(s, "ship-2")).toBeUndefined();
    expect(selectedWeapon(s)).toBe("pulse");
    const db = new SaveDatabase(`weapons-${crypto.randomUUID()}`);
    try {
      await db.write(s);
      const restored = (await db.read())!;
      expect(activateShip(restored, "ship-1")).toBeUndefined();
      expect(selectedWeapon(restored)).toBe("ion");
      restored.upgrades = [];
      expect(selectedWeapon(restored)).toBe("pulse");
    } finally {
      await db.delete();
    }
  });

  it("reduz o escudo mais rápido com íons sem multiplicar o dano ao casco", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const npc = trafficFor(g.system, g.state.progression.piracy)[0]!;
    npc.shield = 20;
    const hull = npc.hull;
    hitNpc(g.state, g.system, npc, 13, 2.5);
    expect(npc.shield).toBe(0);
    expect(npc.hull).toBe(hull - 5);
  });
});
