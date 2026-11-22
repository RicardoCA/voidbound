import { biomeSupportsAcidRain, weatherCeiling, type Precipitation } from "../game/procedural/weather";
import type { Terrain } from "../game/procedural/terrain";
import type { Settlement } from "../game/types";
import { CROP_GROWTH, cropReady, seedBiome } from "./seedCatalog";

export function advanceCrops(
  terrain: Terrain, settlement: Settlement,
  weather: { kind: Precipitation; intensity: number } | undefined,
) {
  let matured = false;
  let rotted = 0;
  const crops = settlement.crops;
  if (!crops) return { matured, rotted };
  for (const [key, plant] of Object.entries(crops)) {
    if (cropReady(plant)) continue;
    const [x = 0, y = 0, z = 0] = key.split(",").map(Number);
    if (terrain.getAt(x, y, z) !== 0 || terrain.getAt(x, y + 1, z) !== 1) continue;
    if (weather?.kind === "acid" && weather.intensity > 0 &&
        !plant.established && !biomeSupportsAcidRain(seedBiome(plant.seed)) &&
        weatherCeiling(terrain, settlement, x, y, z) === Infinity) {
      delete crops[key];
      rotted++;
      continue;
    }
    if (weather?.kind === "rain" && weatherCeiling(terrain, settlement, x, y, z) === Infinity)
      plant.moisture = Math.min(CROP_GROWTH, plant.moisture + weather.intensity * 2);
    const water = Math.min(1, plant.moisture, CROP_GROWTH - plant.growth);
    if (water <= 0) continue;
    plant.moisture -= water;
    plant.growth += water;
    if (cropReady(plant)) matured = true;
  }
  return { matured, rotted };
}
