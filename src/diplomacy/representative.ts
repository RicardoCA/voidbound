import { footprint } from "../construction/pieces";
import type { Terrain } from "../game/procedural/terrain";
import type { Settlement } from "../game/types";

// Keep the representative outside the entire vertical footprint of construction,
// including roofs, background walls and wide furniture.
export function representativePosition(
  terrain: Terrain,
  settlement: Settlement,
  landingX: number,
) {
  const occupied = new Set<number>();
  for (const [key, piece] of Object.entries(settlement.pieces)) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    for (const cell of footprint(piece.kind, x, y)) occupied.add(cell.x);
  }
  for (const key of Object.keys(settlement.walls))
    occupied.add(Number(key.split(",")[0]));

  const preferred = landingX + 6;
  for (let distance = 0; distance <= 512; distance++) {
    const candidates =
      distance === 0
        ? [preferred]
        : [preferred + distance, preferred - distance];
    for (const column of candidates) {
      if (
        Math.abs(column - landingX) < 5 ||
        occupied.has(column - 1) ||
        occupied.has(column) ||
        occupied.has(column + 1)
      )
        continue;
      let ground = 0;
      while (ground < 64 && terrain.get(column, ground) === 0) ground++;
      if (ground < 2 || ground >= 63) continue;
      return { x: column * 16 + 8, y: ground * 16 - 13 };
    }
  }
}
