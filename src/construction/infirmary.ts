import type { Terrain } from "../game/procedural/terrain";
import type { Save, Settlement } from "../game/types";
import { consume } from "../inventory/inventory";
import { connectedPowerSources, daylight, spendBatteryCharge } from "./habitat";

export const INFIRMARY_HEAL = 40;
export const INFIRMARY_ENERGY = 12;

export function infirmaryInReach(data: Settlement, state: Save, key: string) {
  if (state.mode !== "surface" || data.pieces[key]?.kind !== "infirmary") return false;
  const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
  const { player } = state;
  return Math.hypot((x + 1) * 16 - player.x, y * 16 + 8 - player.y,
    depth * 16 - (player.surfaceZ ?? 0)) <= 48;
}

export function infirmaryPower(terrain: Terrain, data: Settlement, key: string, time: number) {
  const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
  const sources = connectedPowerSources(terrain, data, [{ x: x + .5, y, depth }]);
  const solar = sources.panels > 0 && daylight(time) > 0;
  return { ...sources, solar, available: solar || sources.charge >= INFIRMARY_ENERGY };
}

export function treatAtInfirmary(
  terrain: Terrain, data: Settlement, state: Save, key: string,
) {
  if (!infirmaryInReach(data, state, key)) return "Aproxime-se da câmara para iniciar o tratamento.";
  const { player, backpack, time } = state;
  if (player.health <= 0 || (player.health >= 100 && !(player.sickness ?? 0)))
    return "Nenhum tratamento necessário.";
  if (!(backpack.medicalSupplies ?? 0)) return "Faltam suprimentos médicos na mochila.";
  const power = infirmaryPower(terrain, data, key, time);
  if (!power.solar && !spendBatteryCharge(data, power, INFIRMARY_ENERGY))
    return "Sem energia. Conecte uma placa solar exposta ou uma bateria carregada.";
  consume(backpack, { medicalSupplies: 1 });
  player.health = Math.min(100, player.health + INFIRMARY_HEAL);
  delete player.sickness;
}
