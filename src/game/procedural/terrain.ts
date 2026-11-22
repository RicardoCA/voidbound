import { createNoise2D, createNoise3D } from "simplex-noise";
import { random, LRU, hash } from "./random";
import type { Planet, Item } from "../types";
export const TILE = 16,
  CHUNK_W = 32,
  CHUNK_H = 64;
export const STONE_TILE = 12;
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
export class Terrain {
  private noise;
  private depthNoise;
  private edits = 0;

  get editRevision() {
    return this.edits;
  }
  private depthHeights = new LRU<string, number>(1200);
  private cache = new LRU<number, Uint8Array>(12);
  constructor(
    readonly planet: Planet,
    readonly changes: Record<string, number>,
  ) {
    this.noise = createNoise2D(random(planet.seed));
    this.depthNoise = createNoise3D(random(planet.seed ^ 0x63b12a7));
  }
  height(x: number) {
    if (Math.abs(x) < 9) return 29;
    return Math.floor(
      29 + this.noise(x / 65, 0) * 7 + this.noise(x / 19, 5) * 2,
    );
  }
  chunk(cx: number) {
    const cached = this.cache.get(cx);
    if (cached) return cached;
    const data = new Uint8Array(CHUNK_W * CHUNK_H);
    for (let lx = 0; lx < CHUNK_W; lx++)
      for (let y = 0; y < CHUNK_H; y++) {
        const x = cx * CHUNK_W + lx,
          h = this.height(x);
        if (y < h) continue;
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
    if (depth === 0) return this.height(x);
    const key = `${x},${depth}`;
    const cached = this.depthHeights.get(key);
    if (cached !== undefined) return cached;
    const amplitude = Math.min(1, Math.abs(depth) / 10);
    const height = this.height(x) + Math.round(amplitude * (
      this.depthNoise(x / 26, depth / 18, .6) * 5 +
      this.depthNoise(x / 8, depth / 9, 4) * 1.5
    ));
    return this.depthHeights.set(key, height);
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
    if (y < this.heightAt(x, depth)) return 0;
    const seed = hash(`${this.planet.seed}:${key}`);
    if (seed % 4 !== 0) return 1;
    const veins = [[2, 3, 4, STONE_TILE], [4, 5, 7], [8, 7, 2], [9, 10, 3], [6, 5, 11], [8, 4, 9]][this.planet.kind]!;
    return veins[(seed >>> 8) % veins.length]!;
  }

  remove(x: number, y: number, depth = 0) {
    this.changes[this.keyAt(x, y, depth)] = 0;
    this.edits++;
  }
  get cachedChunks() {
    return this.cache.size;
  }
}
