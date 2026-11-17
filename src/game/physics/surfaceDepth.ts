import type { Fruit } from "../../survival/wildlife";
import type { AlienTree } from "../procedural/trees";
import { pieceAt } from "../../construction/pieces";
import { TILE, type Terrain } from "../procedural/terrain";
import type { Settlement } from "../types";
import type { Actor } from "./surface";

export const surfaceLayer = (z: number) => Math.floor((z + TILE / 2) / TILE);

export function solidSurfaceVoxel(
  terrain: Terrain,
  settlement: Settlement,
  x: number,
  y: number,
  depth: number,
) {
  const piece = pieceAt(settlement, x, y, depth)?.piece;
  return terrain.getAt(x, y, depth) !== 0 ||
    !!settlement.depthBlocks?.[terrain.keyAt(x, y, depth)] ||
    piece?.kind === "woodBlock" ||
    (!!piece && !piece.open && (piece.kind === "woodHatch" ||
      (piece.kind === "woodDoor" && piece.rotation === undefined)));
}

export const surfaceWallZ = -6;
export const surfaceWallThickness = 3;

export function surfaceWallPenetration(settlement: Settlement, x: number, y: number, z: number) {
  const margin = 3.8;
  const halfPanel = surfaceWallThickness / 2 + margin;
  let penetration = 0;
  for (let depth = surfaceLayer(z - margin); depth <= surfaceLayer(z + margin); depth++)
    for (let column = Math.floor((x - margin) / TILE); column <= Math.floor((x + margin) / TILE); column++)
      for (let row = Math.floor((y - 11.9) / TILE); row <= Math.floor((y + 11.9) / TILE); row++) {
        const key = depth ? `${column},${row},${depth}` : `${column},${row}`;
        const wall = (depth ? settlement.depthWalls : settlement.walls)?.[key];
        const door = pieceAt(settlement, column, row, depth)?.piece;
        const rotations = [];
        if (wall) {
          rotations.push(settlement.wallRotations?.[key] ?? 0);
          for (const face of Object.keys(settlement.cornerWalls?.[key] ?? {})) rotations.push(Number(face));
        }
        if (door?.kind === "woodDoor" && !door.open && door.rotation !== undefined)
          rotations.push(door.rotation);
        for (const rotation of rotations) {
          const offset = rotation < 2 ? surfaceWallZ : -surfaceWallZ;
          const normal = rotation % 2 === 0
            ? z - depth * TILE - offset
            : x - (column + 0.5) * TILE - offset;
          penetration = Math.max(penetration, halfPanel - Math.abs(normal));
        }
      }
  return penetration;
}

export function surfaceWallBlocks(settlement: Settlement, x: number, y: number, z: number) {
  return surfaceWallPenetration(settlement, x, y, z) > 0;
}

export function surfaceFloraCollision(
  origin: { x: number; y: number; z: number },
  trees: readonly AlienTree[],
  fruit: readonly Fruit[],
) {
  const obstacles = [
    ...trees.map((tree) => ({
      x: (tree.x + 0.5) * TILE,
      z: tree.depth ? tree.depth * TILE : 5,
      bottom: tree.ground * TILE,
      height: tree.height * TILE * 0.78,
      halfWidth: 4.7,
      halfDepth: 4.3,
    })),
    ...fruit.map((item) => ({
      x: item.x,
      z: item.depth ? item.depth * TILE : 9,
      bottom: item.y,
      height: 10,
      halfWidth: 8.5,
      halfDepth: 5,
    })),
  ];
  const overlaps = (
    object: (typeof obstacles)[number],
    x: number,
    y: number,
    z: number,
  ) =>
    Math.abs(x - object.x) < object.halfWidth + 3.8 &&
    Math.abs(z - object.z) < object.halfDepth + 3.8 &&
    y + 11.9 > object.bottom - object.height &&
    y - 11.9 < object.bottom;
  // If an old save or fruit regrowth places the player inside a prop, allow escape.
  const nearby = obstacles.filter(
    (object) =>
      Math.hypot(origin.x - object.x, origin.z - object.z) <= 24 &&
      !overlaps(object, origin.x, origin.y, origin.z),
  );
  return (x: number, y: number, z: number) =>
    nearby.some((object) => overlaps(object, x, y, z));
}

export function stepSurfaceDepth(
  actor: Actor & { z: number },
  dx: number,
  dz: number,
  jump: boolean,
  gravity: number,
  dt: number,
  solid: (x: number, y: number, depth: number) => boolean,
  blockedByProps?: (x: number, y: number, z: number) => boolean,
) {
  const a = { ...actor };
  const clear = (x: number, y: number, z: number) => {
    if (blockedByProps?.(x, y, z)) return false;
    const top = Math.floor((y - 11.9) / TILE);
    const bottom = Math.floor((y + 11.9) / TILE);
    for (const wx of [x - 3.8, x + 3.8])
      for (const wz of [z - 3.8, z + 3.8])
        for (let row = top; row <= bottom; row++)
          if (solid(Math.floor(wx / TILE), row, surfaceLayer(wz))) return false;
    return true;
  };
  const move = (x: number, z: number) => {
    if (clear(x, a.y, z)) {
      a.x = x;
      a.z = z;

    }
  };
  move(a.x + dx, a.z);
  move(a.x, a.z + dz);
  if (jump && a.grounded) a.vy = -190;
  a.vy += 340 * gravity * dt;
  const steps = Math.max(1, Math.ceil(Math.abs(a.vy * dt) / 3));
  const dy = (a.vy * dt) / steps;
  let fallDamage = 0;
  a.grounded = false;
  for (let i = 0; i < steps; i++) {
    if (clear(a.x, a.y + dy, a.z)) {
      a.y += dy;
      continue;
    }
    // Recover the closest free height without advancing into the solid voxel.
    let safe = 0,
      blocked = 1;
    for (let attempt = 0; attempt < 8; attempt++) {
      const mid = (safe + blocked) / 2;
      if (clear(a.x, a.y + dy * mid, a.z)) safe = mid;
      else blocked = mid;
    }
    a.y += dy * safe;
    a.grounded = dy >= 0;
    if (a.grounded && a.vy > 320) fallDamage = (a.vy - 320) * 0.08;
    a.vy = 0;
    break;
  }
  return { ...a, fallDamage };
}
