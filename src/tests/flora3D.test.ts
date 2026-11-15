import { expect, it } from "vitest";
import { emptySettlement } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import { spatialTreesNear, treeAt } from "../game/procedural/trees";
import {
  stepSurfaceDepth,
  surfaceFloraCollision,
} from "../game/physics/surfaceDepth";
import type { Planet } from "../game/types";
import { fruitsNear } from "../survival/wildlife";
import { systemAt } from "../universe/generator";

it("gera flora nos seis biomas fora da faixa e preserva coleta e corte", () => {
  const base = systemAt("VOIDBOUND", 0, 0).planets[0]!;
  for (const kind of [0, 1, 2, 3, 4, 5] as const) {
    const planet: Planet = { ...base, kind };
    const terrain = new Terrain(planet, {});
    const settlement = emptySettlement();
    const trees = spatialTreesNear(terrain, 40, 0, []);
    const fruit = fruitsNear(planet, terrain, settlement, 40, 0, 0);
    expect(
      trees.filter(
        (tree) => Math.hypot(tree.x * 16 + 8 - 40, tree.depth! * 16) < 160,
      ).length,
    ).toBeGreaterThan(2);
    expect(
      fruit.filter(
        (item) => item.depth && Math.hypot(item.x - 40, item.depth * 16) < 160,
      ).length,
    ).toBeGreaterThan(2);
    const found = fruit.find((item) => item.depth)!;
    expect(spatialTreesNear(terrain, 40, 0, [trees[0]!.id])).not.toContainEqual(
      trees[0],
    );
    settlement.foraged = { [found.id]: 180 };
    expect(
      fruitsNear(planet, terrain, settlement, 40, 10, 0),
    ).not.toContainEqual(found);
    expect(fruitsNear(planet, terrain, settlement, 40, 181, 0)).toContainEqual(
      found,
    );
  }
});

it("impede atravessar troncos e frutas na profundidade em que aparecem", () => {
  const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;
  const terrain = new Terrain(planet, {});
  const tree = { ...treeAt(planet, terrain, 0)!, x: 0, depth: 1, ground: 10 };
  const berry = {
    id: "fruit",
    item: "basaltBerry" as const,
    color: 0,
    x: 8,
    y: 154,
    depth: 1,
  };
  const actor = { x: -6, y: 148, z: 16, vy: 0, grounded: true };
  const floor = (_x: number, row: number) => row >= 10;
  const walk = (trees: (typeof tree)[], fruit: (typeof berry)[]) =>
    stepSurfaceDepth(
      actor,
      9,
      0,
      false,
      1,
      0.04,
      floor,
      surfaceFloraCollision(actor, trees, fruit),
    );
  expect(walk([tree], []).x).toBe(actor.x);
  expect(walk([], [berry]).x).toBe(actor.x);
  expect(walk([], []).x).toBe(actor.x + 9);
});
