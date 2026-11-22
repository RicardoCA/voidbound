import { pieceAt } from "../../construction/pieces";
import type { Settlement } from "../types";
import { isLiquidTile, TILE, type Terrain } from "../procedural/terrain";
import { solidSurfaceVoxel, surfaceWallBlocks } from "./surfaceDepth";

export interface LandedHull {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  intersectsMesh?: (x: number, y: number, z: number) => boolean;
}

export const fallbackLandedHull: LandedHull = {
  minX: -110, maxX: 110, minY: -62, maxY: 3, minZ: -70, maxZ: 70,
};

export function landedHullOverlap(hull: LandedHull, x: number, y: number, z: number) {
  const overlap = Math.max(0, Math.min(
    x - hull.minX + 4, hull.maxX + 4 - x,
    y - hull.minY + 12, hull.maxY + 12 - y,
    z - hull.minZ + 4, hull.maxZ + 4 - z,
  ));
  return hull.intersectsMesh ? Number(overlap > 0 && hull.intersectsMesh(x, y, z)) : overlap;
}

export function landingSideExit(terrain: Terrain, settlement: Settlement, pad: number, hull: LandedHull) {
  const candidates: { x: number; y: number; z: number; score: number }[] = [];
  const ground = terrain.height(pad) * TILE;
  for (let distance = 0; distance < 4; distance++)
    for (const side of [1, -1]) {
      const edge = side === 1 ? hull.maxZ : -hull.minZ;
      const depth = side * (Math.ceil((edge + 6) / TILE) + distance);
      const z = depth * TILE;
      for (let offset = -5; offset <= 5; offset++) {
        const column = pad + offset;
        for (let row = Math.max(2, terrain.heightAt(column, depth) - 6); row < 63; row++) {
          if (!solidSurfaceVoxel(terrain, settlement, column, row, depth)) continue;
          const x = column * TILE + TILE / 2;
          const y = row * TILE - 12;
          if (pieceAt(settlement, column, row - 1, depth) ||
              pieceAt(settlement, column, row - 2, depth) ||
              solidSurfaceVoxel(terrain, settlement, column, row - 1, depth) ||
              solidSurfaceVoxel(terrain, settlement, column, row - 2, depth) ||
              isLiquidTile(terrain.getAt(column, row - 1, depth)) ||
              isLiquidTile(terrain.getAt(column, row - 2, depth)) ||
              surfaceWallBlocks(settlement, x, y, z)) continue;
          if (landedHullOverlap(hull, x - pad * TILE, y - ground, z)) continue;
          candidates.push({ x, y, z, score: Math.hypot(x - pad * TILE, (y - ground) * 2, Math.abs(z) - edge) });
        }
      }
    }
  return candidates.sort((a, b) => a.score - b.score)[0];
}
