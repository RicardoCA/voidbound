import { createNoise2D } from "simplex-noise";
import { random, LRU, hash } from "./random";
import type { Planet, Item } from "../types";
export const TILE = 16,
  CHUNK_W = 32,
  CHUNK_H = 64;
export const tileItems: Record<number, Item> = {
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
};
export class Terrain {
  private noise;
  private cache = new LRU<number, Uint8Array>(12);
  constructor(
    readonly planet: Planet,
    readonly changes: Record<string, number>,
  ) {
    this.noise = createNoise2D(random(planet.seed));
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
  remove(x: number, y: number) {
    this.changes[`${x},${y}`] = 0;
  }
  get cachedChunks() {
    return this.cache.size;
  }
}
