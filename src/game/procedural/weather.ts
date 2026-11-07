import type { Planet, Settlement } from "../types";
import type { Terrain } from "./terrain";
import { hash } from "./random";
import { solidCell } from "../physics/surface";

export type Precipitation = "rain" | "acid" | "snow";
export const weatherLabels: Record<Precipitation, string> = {
  rain: "Chuva",
  acid: "Chuva ácida",
  snow: "Neve",
};

export function planetPrecipitation(planet: Planet): Precipitation | undefined {
  const roll = hash(`${planet.seed}:climate`) % 100;
  switch (planet.kind) {
    case 0:
      return roll < 40 ? undefined : roll < 60 ? "acid" : "rain";
    case 1:
      return roll < 85 ? undefined : "rain";
    case 2:
      return roll < 25 ? undefined : "snow";
    case 3:
      return roll < 5 ? undefined : "rain";
    case 4:
      return roll < 55 ? undefined : "acid";
    case 5:
      return roll < 10 ? "acid" : "rain";
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
) {
  for (let row = 0; row < limit; row++)
    if (solidCell(terrain, settlement, column, row)) return row * 16;
  return Infinity;
}
