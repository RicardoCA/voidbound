import type { Planet, Settlement } from "../types";
import type { Terrain } from "./terrain";
import { hash } from "./random";
import { solidSurfaceVoxel } from "../physics/surfaceDepth";

export type Precipitation = "rain" | "acid" | "snow";
export const weatherLabels: Record<Precipitation, string> = {
  rain: "Chuva",
  acid: "Chuva ácida",
  snow: "Neve",
};
const acidRainRolls: Partial<Record<number, readonly [number, number]>> = {
  0: [40, 60],
  4: [55, 100],
  5: [0, 10],
};

export function biomeSupportsAcidRain(kind: number) {
  return acidRainRolls[kind] !== undefined;
}

export function planetPrecipitation(planet: Planet): Precipitation | undefined {
  const roll = hash(`${planet.seed}:climate`) % 100;
  const acid = acidRainRolls[planet.kind];
  if (acid && roll >= acid[0] && roll < acid[1]) return "acid";
  switch (planet.kind) {
    case 0:
      return roll < 40 ? undefined : "rain";
    case 1:
      return roll < 85 ? undefined : "rain";
    case 2:
      return roll < 25 ? undefined : "snow";
    case 3:
      return roll < 5 ? undefined : "rain";
    case 5:
      return "rain";
  }
}

export function weatherAt(planet: Planet, time: number) {
  const kind = planetPrecipitation(planet);
  if (!kind) return;
  const seed = hash(`${planet.seed}:storms`);
  const period = 165 + (seed % 100);
  const duration = 30 + (seed % 30);
  const start = 28 + ((seed >>> 8) % (period - duration - 28));
  const elapsed = (time % period) - start;
  if (elapsed < 0 || elapsed >= duration) return;
  return {
    kind,
    intensity: Math.min(1, elapsed / 3, (duration - elapsed) / 4),
  };
}

// The first solid tile stops falling precipitation, including above open rooms.
export function weatherCeiling(
  terrain: Terrain,
  settlement: Settlement,
  column: number,
  limit = 64,
  depth = 0,
) {
  for (let row = 0; row < limit; row++)
    if (solidSurfaceVoxel(terrain, settlement, column, row, depth)) return row * 16;
  return Infinity;
}

/** Exact forecast of the same seeded cycle used by precipitation. */
export function forecastWeather(planet: Planet, time: number) {
  const kind = planetPrecipitation(planet);
  if (!kind) return undefined;
  const seed = hash(`${planet.seed}:storms`), period = 165 + (seed % 100), duration = 30 + (seed % 30);
  const start = 28 + ((seed >>> 8) % (period - duration - 28));
  const phase = time % period;
  const active = phase >= start && phase < start + duration;
  return { kind, active, seconds: Math.ceil(active ? start + duration - phase : phase < start ? start - phase : period - phase + start), cycle: Math.floor((time - start) / period) };
}
