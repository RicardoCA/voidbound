import {
  items,
  type Inventory,
  type Item,
  type Planet,
  type Save,
  type StarSystem,
} from "../game/types";
import { cabinetCapacity } from "./building";
import { isCabinet, type CabinetKind } from "./pieces";
import { slots } from "../inventory/inventory";
import { systemAt } from "../universe/generator";
import { nearestLanding } from "../universe/landings";
export interface CabinetSummary {
  key: string;
  x: number;
  y: number;
  inventory: Inventory;
  units: number;
  usedSlots: number;
  capacity: number;
  kind: CabinetKind;
  landing: ReturnType<typeof nearestLanding>;
}
export interface BaseSummary {
  planet: Planet;
  system: StarSystem;
  pieces: number;
  walls: number;
  cabinets: CabinetSummary[];
  occupiedCabinets: number;
  inventory: Inventory;
  units: number;
}
export interface SystemBases {
  bases: BaseSummary[];
  units: number;
  cabinets: number;
}
/** Parse from the seed prefix, so user seeds containing ':' remain valid. */
export function planetAddress(seed: string, id: string) {
  const prefix = `${seed}:`;
  if (!id.startsWith(prefix)) return;
  const match = /^(-?\d+):(-?\d+):p([0-7])$/.exec(id.slice(prefix.length));
  if (!match) return;
  const x = Number(match[1]),
    y = Number(match[2]),
    planetIndex = Number(match[3]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return;
  return { x, y, planetIndex };
}
function cleanInventory(source: Inventory): Inventory {
  const result: Inventory = {};
  for (const [id, n] of Object.entries(source))
    if (Object.hasOwn(items, id) && Number.isSafeInteger(n) && n! > 0)
      result[id as Item] = n;
  return result;
}
export function inventoryUnits(inventory: Inventory) {
  return Object.values(inventory).reduce((sum, n) => sum + (n ?? 0), 0);
}
/** Read-only index of actual saved structures; no scan of unexplored sectors. */
export function listBases(save: Save): BaseSummary[] {
  const result: BaseSummary[] = [];
  for (const [planetId, settlement] of Object.entries(save.settlements)) {
    const pieces = Object.keys(settlement.pieces).length,
      walls = Object.keys(settlement.walls).length;
    if (!pieces && !walls) continue;
    const address = planetAddress(save.seed, planetId);
    if (!address) continue;
    const system = systemAt(save.seed, address.x, address.y),
      planet = system.planets[address.planetIndex];
    if (!planet || planet.id !== planetId) continue;
    const inventory: Inventory = {},
      cabinets: CabinetSummary[] = [];
    for (const [key, piece] of Object.entries(settlement.pieces)) {
      if (!isCabinet(piece.kind)) continue;
      const match = /^(-?\d+),(-?\d+)$/.exec(key);
      if (!match) continue;
      const x = Number(match[1]),
        y = Number(match[2]);
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) continue;
      const content = cleanInventory(settlement.cabinets[key] ?? {}),
        units = inventoryUnits(content);
      cabinets.push({
        key,
        x,
        y,
        inventory: content,
        units,
        usedSlots: slots(content),
        capacity: cabinetCapacity(piece.kind),
        kind: piece.kind,
        landing: nearestLanding(x),
      });
      for (const [id, n] of Object.entries(content))
        inventory[id as Item] = (inventory[id as Item] ?? 0) + n!;
    }
    cabinets.sort((a, b) => b.units - a.units || a.x - b.x || a.y - b.y);
    result.push({
      planet,
      system,
      pieces,
      walls,
      cabinets,
      occupiedCabinets: cabinets.filter((c) => c.units > 0).length,
      inventory,
      units: inventoryUnits(inventory),
    });
  }
  return result.sort(
    (a, b) =>
      b.units - a.units ||
      a.planet.name.localeCompare(b.planet.name) ||
      a.planet.id.localeCompare(b.planet.id),
  );
}
export function groupBases(bases: BaseSummary[]) {
  const result = new Map<string, SystemBases>();
  for (const base of bases) {
    const group = result.get(base.system.id) ?? {
      bases: [],
      units: 0,
      cabinets: 0,
    };
    group.bases.push(base);
    group.units += base.units;
    group.cabinets += base.cabinets.length;
    result.set(base.system.id, group);
  }
  return result;
}
