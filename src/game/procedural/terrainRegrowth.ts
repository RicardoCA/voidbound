import { pieceAt } from "../../construction/pieces";
import type { Save } from "../types";

export const TERRAIN_REGROWTH_SECONDS = 24 * 60 * 60;

export function regrowTerrain(state: Save, surfacePlanetId?: string) {
  const now = state.activePlayTime ?? 0;
  const deadlines = (state.terrainRegrowth ??= {});
  let changed = false;
  for (const [planetId, tiles] of Object.entries(state.changes)) {
    for (const [key, tile] of Object.entries(tiles)) {
      if (tile !== 0) continue;
      const pending = (deadlines[planetId] ??= {});
      if ((pending[key] ??= now + TERRAIN_REGROWTH_SECONDS) > now) continue;
      const [x, y] = key.split(",").map(Number) as [number, number];
      const settlement = state.settlements[planetId];
      if (settlement && (settlement.walls[key] || pieceAt(settlement, x, y)))
        continue;
      if (
        planetId === surfacePlanetId &&
        Math.abs(state.player.x - (x * 16 + 8)) < 24 &&
        Math.abs(state.player.y - (y * 16 + 8)) < 32
      )
        continue;
      delete tiles[key];
      delete pending[key];
      changed = true;
    }
  }
  return changed;
}
