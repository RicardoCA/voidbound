import { createNoise2D, createNoise3D } from "simplex-noise";
import { random, LRU, hash } from "./random";
import type { Planet, Item } from "../types";
export const TILE = 16,
  CHUNK_W = 32,
  CHUNK_H = 64;
export const STONE_TILE = 12;
export const WATER_TILE = 13;
export const LAVA_TILE = 14;
export function isLiquidTile(tile: number) {
  return tile === WATER_TILE || tile === LAVA_TILE;
}
export function isSolidTile(tile: number) {
  return tile !== 0 && !isLiquidTile(tile);
}
export const tileItems: Partial<Record<number, Item>> = {
  1: "dirt",
  2: "iron",
  3: "copper",
  4: "silicon",
  5: "carbon",
  6: "titanium",
  7: "crystal",
  8: "ice",
  9: "fiber",
  10: "wood",
  11: "rawFuel",
  [STONE_TILE]: "stone",
};
const itemTiles = new Map(
  Object.entries(tileItems).flatMap(([tile, item]) => item ? [[item, Number(tile)] as const] : []),
);
export function tileForItem(item: Item) {
  return itemTiles.get(item);
}
export class Terrain {
  private noise;
  private depthNoise;
  private edits = 0;

  get editRevision() {
    return this.edits;
  }
  private columns = new LRU<string, { ground: number; water?: number }>(1800);
  private cache = new LRU<number, Uint8Array>(12);
  constructor(
    readonly planet: Planet,
    readonly changes: Record<string, number>,
  ) {
    this.noise = createNoise2D(random(planet.seed));
    this.depthNoise = createNoise3D(random(planet.seed ^ 0x63b12a7));
  }
  private baseHeight(x: number) {
    if (Math.abs(x) < 9) return 29;
    return Math.floor(
      29 + this.noise(x / 65, 0) * 7 + this.noise(x / 19, 5) * 2,
    );
  }
  private columnAt(x: number, depth: number) {
    const key = `${x},${depth}`;
    const cached = this.columns.get(key);
    if (cached) return cached;
    const amplitude = Math.min(1, Math.abs(depth) / 10);
    const ground = this.baseHeight(x) + (depth === 0 ? 0 : Math.round(amplitude * (
      this.depthNoise(x / 26, depth / 18, .6) * 5 +
      this.depthNoise(x / 8, depth / 9, 4) * 1.5
    )));
    // Leave room to disembark dry at all three landing zones.
    const nearPad = Math.abs(depth) <= 7 && x >= -7 && x <= 55 &&
      Math.abs(x - Math.round(x / 24) * 24) <= 7;
    if (!nearPad && Math.hypot(x, depth) >= 16) {
      if (this.planet.kind === 5 && ground > 28)
        return this.columns.set(key, { ground, water: 28 });
      if (this.planet.kind === 0 || this.planet.kind === 3 || this.planet.kind === 5) {
        const bend = this.noise(depth / 34, 51) * 13;
        const channel = x - bend - 40;
        const distance = Math.abs(channel - Math.round(channel / 83) * 83);
        if (distance < 2.4)
          return this.columns.set(key, { ground: ground + 2, water: ground });
      }
    }
    return this.columns.set(key, { ground });
  }
  private lavaAt(x: number, y: number, depth: number, ground: number) {
    return y >= Math.max(45, ground + 12) && y < 63 &&
      this.depthNoise(x / 10, depth / 10, y / 5 + 30) >
        (this.planet.kind === 4 ? .40 : .59);
  }
  private lavaCavityAt(x: number, y: number, depth: number, ground: number) {
    return y >= Math.max(43, ground + 10) &&
      (this.lavaAt(x, y + 1, depth, ground) || this.lavaAt(x, y + 2, depth, ground));
  }
  height(x: number) {
    return this.columnAt(x, 0).ground;
  }
  chunk(cx: number) {
    const cached = this.cache.get(cx);
    if (cached) return cached;
    const data = new Uint8Array(CHUNK_W * CHUNK_H);
    for (let lx = 0; lx < CHUNK_W; lx++) {
      const x = cx * CHUNK_W + lx;
      const { ground: h, water } = this.columnAt(x, 0);
      for (let y = 0; y < CHUNK_H; y++) {
        if (y < h) {
          if (water !== undefined && y >= water) data[y * CHUNK_W + lx] = WATER_TILE;
          continue;
        }
        if (this.lavaAt(x, y, 0, h)) {
          data[y * CHUNK_W + lx] = LAVA_TILE;
          continue;
        }
        if (this.lavaCavityAt(x, y, 0, h)) continue;
        if (y > h + 5 && this.noise(x / 13, y / 9) > 0.34) continue;
        let tile = 1;
        const ore = hash(`${this.planet.seed}:${x}:${y}`) % 100;
        if (ore < 33) {
          const options = [
            2,
            3,
            4,
            5,
            11,
            ...[
              [2, 3, 4],
              [4, 7, 5],
              [8, 7, 2],
              [9, 10, 3],
              [6, 5, 11],
              [8, 4, 9],
            ][this.planet.kind]!,
          ];
          tile =
            options[
              hash(`${x}:${y}:${this.planet.seed}:ore`) % options.length
            ]!;
        }
        if (Math.abs(x) < 8 && y === h) tile = 2 + ((x + 8) % 3);
        if (
          tile === 1 &&
          this.planet.kind === 0 &&
          (ore < 58 || (Math.abs(x) < 8 && y === h + 1))
        )
          tile = STONE_TILE;
        data[y * CHUNK_W + lx] = tile;
      }
    }
    return this.cache.set(cx, data);
  }
  get(x: number, y: number) {
    if (y < 0) return 0;
    if (y >= CHUNK_H) return 1;
    const key = `${x},${y}`;
    if (key in this.changes) return this.changes[key]!;
    const cx = Math.floor(x / CHUNK_W);
    return this.chunk(cx)[y * CHUNK_W + (((x % 32) + 32) % 32)]!;
  }
  heightAt(x: number, depth: number) {
    return this.columnAt(x, depth).ground;
  }
  waterLevelAt(x: number, depth: number) {
    return this.columnAt(x, depth).water;
  }

  keyAt(x: number, y: number, depth = 0) {
    return depth === 0 ? `${x},${y}` : `${x},${y},${depth}`;
  }

  getAt(x: number, y: number, depth = 0) {
    if (depth === 0) return this.get(x, y);
    if (y < 0) return 0;
    if (y >= CHUNK_H) return 1;
    const key = this.keyAt(x, y, depth);
    const changed = this.changes[key];
    if (changed !== undefined) return changed;
    const { ground, water } = this.columnAt(x, depth);
    if (y < ground) return water !== undefined && y >= water ? WATER_TILE : 0;
    if (this.lavaAt(x, y, depth, ground)) return LAVA_TILE;
    if (this.lavaCavityAt(x, y, depth, ground)) return 0;
    const seed = hash(`${this.planet.seed}:${key}`);
    if (seed % 4 !== 0) return 1;
    const veins = [[2, 3, 4, STONE_TILE], [4, 5, 7], [8, 7, 2], [9, 10, 3], [6, 5, 11], [8, 4, 9]][this.planet.kind]!;
    return veins[(seed >>> 8) % veins.length]!;
  }

  setAt(x: number, y: number, depth: number, tile: number) {
    this.changes[this.keyAt(x, y, depth)] = tile;
    this.edits++;
  }

  remove(x: number, y: number, depth = 0) {
    this.setAt(x, y, depth, 0);
  }
  get cachedChunks() {
    return this.cache.size;
  }
}
