import { blocksAir } from "../../construction/pieces";
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
  return (
    terrain.getAt(x, y, depth) !== 0 ||
    (depth === 0
      ? blocksAir(settlement, x, y)
      : !!settlement.depthBlocks?.[terrain.keyAt(x, y, depth)])
  );
}

export function stepSurfaceDepth(
  actor: Actor & { z: number },
  dx: number,
  dz: number,
  jump: boolean,
  gravity: number,
  dt: number,
  solid: (x: number, y: number, depth: number) => boolean,
) {
  const a = { ...actor };
  const clear = (x: number, y: number, z: number) => {
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
    } else if (
      a.grounded &&
      !jump &&
      clear(a.x, a.y - TILE, a.z) &&
      clear(x, a.y - TILE, z) &&
      !clear(x, a.y - TILE + 1, z)
    ) {
      a.x = x;
      a.z = z;
      a.y -= TILE;
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
