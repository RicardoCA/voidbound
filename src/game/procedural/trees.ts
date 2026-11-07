import type { Planet } from "../types";
import type { Terrain } from "./terrain";
import { hash, random } from "./random";
export interface AlienTree {
  id: string;
  x: number;
  ground: number;
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
export const treeNames = [
  "Cedro de basalto",
  "Acácia âmbar",
  "Conífera glacial",
  "Copa de jade",
  "Árvore brasa",
  "Mangue-lâmina",
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
