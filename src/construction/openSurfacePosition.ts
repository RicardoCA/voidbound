import { footprint } from "./pieces";
import type { Terrain } from "../game/procedural/terrain";
import type { Settlement } from "../game/types";

// Reserve entire columns so the actor cannot appear under a roof or against a wall.
export function openSurfacePosition(
  terrain: Terrain,
  settlement: Settlement | undefined,
  preferred: number,
  clearance: number,
  landingX?: number,
) {
  const occupied = new Set<number>();
  for (const [key, piece] of Object.entries(settlement?.pieces ?? {})) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    for (const cell of footprint(piece.kind, x, y)) occupied.add(cell.x);
  }
  for (const key of Object.keys(settlement?.walls ?? {}))
    occupied.add(Number(key.split(",")[0]));

  for (let distance = 0; distance <= 512; distance++) {
    const candidates =
      distance === 0
        ? [preferred]
        : [preferred + distance, preferred - distance];
    for (const column of candidates) {
      if (landingX !== undefined && Math.abs(column - landingX) < 5) continue;
      let clear = true;
      for (let offset = -clearance; offset <= clearance; offset++)
        if (occupied.has(column + offset)) {
          clear = false;
          break;
        }
      if (!clear) continue;
      let ground = 0;
      while (ground < 64 && terrain.get(column, ground) === 0) ground++;
      if (ground < 2 || ground >= 63) continue;
      return { x: column * 16 + 8, y: ground * 16 - 13 };
    }
  }
}
