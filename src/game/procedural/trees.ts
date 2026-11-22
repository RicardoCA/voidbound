import type { Planet, Settlement } from "../types";
import type { Terrain } from "./terrain";
import { hash, random } from "./random";
import { cropReady } from "../../survival/seedCatalog";
export { treeNames } from "../../survival/seedCatalog";
export interface AlienTree {
  id: string;
  x: number;
  ground: number;
  depth?: number;
  height: number;
  crown: number;
  wood: number;
  variant: number;
  kind: number;
  trunk: number;
  leaves: number;
  accent: number;
}
const foliage = [
  [0x84adab, 0xae99c2, 0x9cab76],
  [0xc9b773, 0xc58d77, 0x9cb7b0],
  [0x8dc2d6, 0xb5abd7, 0xa9d8c5],
  [0x83bd8f, 0x9b82c1, 0xc5b375],
  [0xdf816a, 0xcf9f57, 0xb686b2],
  [0x70c1b4, 0x82a9d1, 0x91c57d],
];
/** One deterministic candidate per 14-tile cell, independent of loaded chunks. */
export function treeAt(
  planet: Planet,
  terrain: Terrain,
  cell: number,
): AlienTree | undefined {
  const seed = hash(`${planet.seed}:forest:${cell}`),
    r = random(seed);
  if (cell !== 0 && r() > [0.7, 0.6, 0.7, 0.95, 0.65, 0.85][planet.kind]!)
    return;
  let x = cell === 0 ? 5 : cell * 14 + 5 + Math.floor(r() * 4);
  // Keep all three landing pads clear without changing existing terrain seeds.
  for (const pad of [0, 24, 48]) if (Math.abs(x - pad) < 4) x = pad + 4;
  const ground = terrain.height(x),
    height = 4 + Math.floor(r() * 3),
    variant = hash(`${planet.seed}:species`) % 3;
  return {
    id: `tree:${cell}`,
    x,
    ground,
    height,
    crown: 2 + Math.floor(r() * 2),
    wood: 10 + height,
    variant,
    kind: planet.kind,
    trunk: [0x8d7d75, 0xb18c61, 0x7d9ba8, 0x917754, 0x795b66, 0x7e9574][
      planet.kind
    ]!,
    leaves: foliage[planet.kind]![variant]!,
    accent: [0xc1ceb2, 0xf0d397, 0xd0eff5, 0xc4e38e, 0xffb867, 0xb8e6cc][
      planet.kind
    ]!,
  };
}
export function treesInRange(
  planet: Planet,
  terrain: Terrain,
  minX: number,
  maxX: number,
  cutTrees: readonly string[] = [],
) {
  const cut = new Set(cutTrees),
    trees: AlienTree[] = [];
  for (
    let cell = Math.floor((minX - 8) / 14);
    cell <= Math.ceil((maxX + 8) / 14);
    cell++
  ) {
    const tree = treeAt(planet, terrain, cell);
    if (
      tree &&
      terrain.get(tree.x, tree.ground) !== 0 &&
      !cut.has(tree.id) &&
      tree.x + tree.crown >= minX &&
      tree.x - tree.crown <= maxX
    )
      trees.push(tree);
  }
  return trees;
}
export function treeContains(tree: AlienTree, worldX: number, worldY: number) {
  return (
    Math.abs(worldX - (tree.x * 16 + 8)) <= 12 &&
    worldY < tree.ground * 16 &&
    worldY >= (tree.ground - tree.height) * 16
  );
}

export function plantedTreeAt(terrain: Terrain, settlement: Settlement, key: string) {
  const crop = settlement.crops?.[key];
  if (!crop?.seed.startsWith("treeSeed-") || !cropReady(crop)) return;
  const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
  const kind = Number(crop.seed.slice("treeSeed-".length));
  const species = treeAt({ ...terrain.planet, kind }, terrain, 0)!;
  return { ...species, id: `planted-tree:${key}`, x, depth, ground: y + 1 };
}

export function plantedTreesNear(terrain: Terrain, settlement: Settlement, x: number, z: number, range: number, spatial: boolean) {
  const trees: AlienTree[] = [];
  for (const key of Object.keys(settlement.crops ?? {})) {
    const tree = plantedTreeAt(terrain, settlement, key);
    if (tree && (spatial || !tree.depth) && Math.hypot(tree.x * 16 + 8 - x, (tree.depth ?? 0) * 16 - z) <= range)
      trees.push(tree);
  }
  return trees;
}

export const groveSize = 4;
export function grovePosition(planet: Planet, kind: "tree" | "fruit", cx: number, cz: number) {
  const seed = hash(`${planet.seed}:grove:${kind}:${cx}:${cz}`);
  const x = cx * groveSize + seed % groveSize;
  const depth = cz * groveSize + (seed >>> 6) % groveSize;
  if (!depth || ([0, 24, 48].some((pad) =>
    Math.abs(x - pad) < 4 && Math.abs(depth) < 3))) return;
  return { x, depth, seed };
}

export function spatialTreeAt(planet: Planet, terrain: Terrain, cx: number, cz: number): AlienTree | undefined {
  const site = grovePosition(planet, "tree", cx, cz);
  if (!site) return;
  const density = [.77, .57, .65, .94, .62, .86][planet.kind]!;
  if ((site.seed >>> 17) % 100 >= density * 100) return;
  const { x, depth, seed } = site;
  const ground = terrain.heightAt(x, depth);
  if (!terrain.getAt(x, ground, depth)) return;
  const variant = (seed >>> 8) % 3;
  const height = 3 + (seed >>> 12) % 3;
  return {
    id: `grove:${cx}:${cz}`, x, depth, ground, height, variant,
    crown: 2 + (seed >>> 14) % 2, wood: height + 10, kind: planet.kind,
    trunk: 0x7f655a, leaves: foliage[planet.kind]![variant]!, accent: 0x9cd6a1,
  };
}

export function spatialTreesNear(terrain: Terrain, worldX: number, worldZ: number, cutTrees: readonly string[]) {
  const unit = groveSize * 16;
  const centerX = Math.floor(worldX / unit), centerZ = Math.floor(worldZ / unit);
  const result: AlienTree[] = [];
  const cut = new Set(cutTrees);
  for (let x = centerX - 3; x <= centerX + 3; x++)
    for (let z = centerZ - 3; z <= centerZ + 3; z++) {
      const tree = spatialTreeAt(terrain.planet, terrain, x, z);
      if (tree && !cut.has(tree.id)) result.push(tree);
    }
  return result;
}
