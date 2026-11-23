import { expect, it, vi } from "vitest";
import { emptySettlement } from "../construction/building";
import { PLANET_DAY } from "../construction/habitat";
import { Terrain } from "../game/procedural/terrain";
import type { PlacedPiece } from "../game/types";
import { monsterCanSpawn, NightMonsters, protectedMonsterPlots, type NightMonster } from "../survival/nightMonsters";
import { systemAt } from "../universe/generator";

const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;
const night = PLANET_DAY / 2;

function flatTerrain() {
  const terrain = new Terrain(planet, {});
  vi.spyOn(terrain, "heightAt").mockReturnValue(29);
  vi.spyOn(terrain, "getAt").mockImplementation((_x, y) => y >= 29 ? 1 : 0);
  return terrain;
}

it("só gera zumbis à noite e exclui o interior de construções abertas", () => {
  const terrain = flatTerrain();
  const data = emptySettlement();
  for (let x = 8; x <= 16; x++)
    for (let z = 8; z <= 16; z++)
      if (x === 8 || x === 16 || z === 8 || z === 16)
        data.pieces[`${x},28,${z}`] = {
          kind: x === 12 && z === 8 ? "fenceGate" : "woodFence",
          facing: 1, open: true,
        };
  const plots = protectedMonsterPlots(data, true);
  expect(monsterCanSpawn(terrain, data, plots, 12, 12)).toBe(false);
  expect(monsterCanSpawn(terrain, data, plots, 19, 12)).toBe(true);
  const monsters = new NightMonsters();
  const player = { x: 200, y: 452, surfaceZ: 192, health: 100 };
  monsters.update(terrain, data, player, 0, .016, true);
  expect(monsters.actors.size).toBe(0);
  for (let i = 0; i < 4; i++) monsters.update(terrain, data, player, night + i * 4, .016, true);
  expect(monsters.actors.size).toBeGreaterThan(0);
  for (const monster of monsters.actors.values())
    expect(monsterCanSpawn(terrain, data, plots, Math.floor(monster.x / 16), Math.round(monster.z / 16))).toBe(true);
  monsters.update(terrain, data, player, PLANET_DAY, .016, true);
  expect(monsters.actors.size).toBe(0);
});

it("persegue e ataca pela passagem aberta, mas ignora a ferramenta de mineração", () => {
  const terrain = flatTerrain();
  const data = emptySettlement();
  const gate: PlacedPiece = { kind: "fenceGate", facing: 1, rotation: 0, open: false };
  data.pieces["12,28,-1"] = gate;
  const monsters = new NightMonsters();
  const zombie: NightMonster = {
    id: "test", variant: 0, x: 200, y: 452, z: -6, vy: 0, grounded: true,
    yaw: 0, health: 4, stride: 0, chasing: false, nextSight: 0, nextAttack: 0, stuck: false,
  };
  const player = { x: 200, y: 452, surfaceZ: -29, health: 100 };
  monsters.actors.set(zombie.id, zombie);
  monsters.update(terrain, data, player, night, .016, true);
  expect(zombie.chasing).toBe(false);
  expect(player.health).toBe(100);
  gate.open = true;
  expect(monsters.strike(zombie.id, player, terrain, data, false)).toBe(false);
  expect(zombie.health).toBe(4);
  monsters.update(terrain, data, player, night + 1, .016, true);
  expect(zombie.chasing).toBe(true);
  expect(zombie.z).toBeLessThan(-6);
  expect(player.health).toBe(88);
  expect(monsters.strike(zombie.id, player, terrain, data, true)).toBe(true);
  expect(zombie.health).toBe(2);
});
