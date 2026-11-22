import type { Save, Settlement } from "../types";
import { Terrain } from "../procedural/terrain";
import { systemAt } from "../../universe/generator";
import { planetAddress } from "../../construction/catalog";
import {
  advancePowerNetwork,
  powerNetwork,
  type PowerNetwork,
} from "../../construction/habitat";
import {
  advanceFacility,
  climateForecast,
} from "../../construction/facilities";
import { isFacility } from "../../construction/facilityTypes";
export class FacilitySystem {
  private cache = new WeakMap<
    Settlement,
    { state: Save; revision: number; terrain: Terrain; network: PowerNetwork }
  >();
  step(state: Save, dt: number, revision: number) {
    if (!Number.isFinite(dt) || dt <= 0) return [];
    const notices: string[] = [];
    for (const [planetId, data] of Object.entries(state.settlements)) {
      const keys = Object.keys(data.pieces).filter((key) =>
        isFacility(data.pieces[key]!.kind),
      );
      if (!keys.length) continue;
      const address = planetAddress(state.seed, planetId);
      if (!address) continue;
      const system = systemAt(state.seed, address.x, address.y),
        planet = system.planets[address.planetIndex]!;
      let cached = this.cache.get(data);
      if (!cached || cached.state !== state || cached.revision !== revision) {
        const terrain = new Terrain(planet, state.changes[planetId] ?? {});
        cached = {
          state,
          revision,
          terrain,
          network: powerNetwork(terrain, data),
        };
        this.cache.set(data, cached);
      }
      advancePowerNetwork(
        data,
        cached.network,
        Math.min(state.time, data.utilityTime ?? state.time - dt),
        state.time,
        true,
      );
      data.utilityTime = state.time;
      for (const key of keys) {
        advanceFacility(state, planet, system, cached.terrain, key, dt);
        const machine = data.machines?.[key];
        if (
          data.pieces[key]?.kind !== "weatherStation" ||
          !machine ||
          !data.pieces[key]?.powered ||
          state.mode !== "surface" ||
          state.planetIndex !== address.planetIndex ||
          state.systemX !== address.x ||
          state.systemY !== address.y
        )
          continue;
        const forecast = climateForecast(planet, state.time);
        if (
          forecast &&
          !forecast.active &&
          forecast.seconds <= 20 &&
          forecast.kind !== "rain" &&
          machine.lastCycle !== forecast.cycle + 1
        ) {
          machine.lastCycle = forecast.cycle + 1;
          notices.push(
            `${forecast.kind === "acid" ? "Chuva ácida" : "Nevasca"} em ${forecast.seconds} segundos. Procure abrigo.`,
          );
        }
      }
    }
    return notices;
  }
}
