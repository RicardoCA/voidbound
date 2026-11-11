import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it } from "vitest";
import { SpaceCombat } from "../combat/flight";
import {
  escortOffers,
  escortTiers,
  hireEscort,
  renewEscort,
  SERVICE_HOUR,
  tickEscorts,
} from "../fleet/escorts";
import { migrateSave } from "../persistence/migrations";
import { useGame } from "../stores/game";

function setup() {
  setActivePinia(createPinia());
  const g = useGame();
  g.state.mode = "docked";
  g.state.credits = 100_000;
  return g;
}

it("restringe contratação à estação clandestina e mantém o piloto após a rotação", () => {
  const g = setup();
  expect(
    hireEscort(g.state, g.system, escortOffers(g.state, g.system)[0].id),
  ).toBeTruthy();
  g.state.systemX = 1;
  const [light, interceptor, heavy] = escortOffers(g.state, g.system);
  expect(hireEscort(g.state, g.system, light.id)).toBeUndefined();
  expect(hireEscort(g.state, g.system, light.id)).toBeTruthy();
  expect(hireEscort(g.state, g.system, interceptor.id)).toBeUndefined();
  expect(hireEscort(g.state, g.system, heavy.id)).toBeTruthy();
  expect(g.state.credits).toBe(66_000);
  g.state.activePlayTime = 1800;
  expect(escortOffers(g.state, g.system)[0].model).not.toBe(light.model);
  expect(
    migrateSave(JSON.parse(JSON.stringify(g.state))).escorts?.[0],
  ).toMatchObject(light);
});

it("cobra por hora ativa, suspende por saldo e pausa a contagem no reparo", () => {
  const g = setup();
  const state = g.state;
  state.systemX = 1;
  hireEscort(state, g.system, escortOffers(state, g.system)[0].id);
  const pilot = state.escorts![0];
  expect(pilot.remaining).toBe(SERVICE_HOUR);
  pilot.remaining = 1;
  state.activePlayTime = 100;
  pilot.repairUntil = 102;
  pilot.hull = 10;
  tickEscorts(state, 1);
  expect(pilot.remaining).toBe(1);
  expect(state.credits).toBe(88_000);
  state.activePlayTime = 102;
  tickEscorts(state, 1);
  expect(pilot.hull).toBe(escortTiers.light.hull);
  expect(pilot.remaining).toBe(SERVICE_HOUR);
  expect(state.credits).toBe(87_000);
  state.credits = 999;
  pilot.remaining = 1;
  expect(tickEscorts(state, 1)[0]).toContain("falta de saldo");
  expect(pilot.remaining).toBe(0);
  expect(tickEscorts(state, 1)).toEqual([]);
  state.credits = 1000;
  expect(renewEscort(state, pilot)).toBeUndefined();
  expect(state.credits).toBe(0);
});

it("a escolta reage a ameaças, recebe dano e recua com casco crítico", () => {
  const g = setup();
  const state = g.state;
  state.systemX = 1;
  hireEscort(state, g.system, escortOffers(state, g.system)[0].id);
  const pilot = state.escorts![0];
  state.mode = "space";
  const combat = new SpaceCombat();
  combat.reset(state, g.system);
  const pirate = combat.npcs.find((npc) => npc.role === "pirate")!;
  pirate.x = state.ship.x + 110;
  pirate.y = state.ship.y;
  combat.update(state, g.system, 0.016);
  expect(combat.bolts.some((bolt) => bolt.escortTarget === pirate.id)).toBe(
    true,
  );
  const ally = combat.escorts[0];
  pilot.hull = 15;
  combat.bolts.push({
    x: ally.x,
    y: ally.y,
    vx: 0,
    vy: 0,
    life: 1,
    hostile: true,
    damage: 5,
  });
  expect(combat.update(state, g.system, 0.016).retreated).toEqual([pilot.name]);
  expect(combat.escorts).toHaveLength(0);
  expect(pilot.repairUntil).toBeGreaterThan(0);
});
