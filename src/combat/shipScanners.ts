import type { Inventory, Item, Save, Station } from "../game/types";
import type { SpaceNpc } from "./traffic";
import { systemAt } from "../universe/generator";

export type ShipScanner = "cargoScanner" | "wantedScanner";
export const shipScanners = {
  cargoScanner: {
    name: "Scanner de carga",
    color: "#f2b072",
    station: "clandestine",
    price: 18_000,
    cost: { circuit: 5, titanium: 4, crystal: 6, cell: 2 },
  },
  wantedScanner: {
    name: "Scanner de procurados",
    color: "#86d9ff",
    station: "standard",
    price: 12_000,
    cost: { circuit: 4, titanium: 3, silicon: 8, cell: 2 },
  },
} satisfies Record<
  ShipScanner,
  {
    name: string;
    color: string;
    station: Station["kind"];
    price: number;
    cost: Inventory;
  }
>;
export const scannerIds = Object.keys(shipScanners) as ShipScanner[];
export const SHIP_SCAN_RANGE = 600;

export function isShipScanner(id: Item): id is ShipScanner {
  return Object.hasOwn(shipScanners, id);
}

export function canCraftScanner(state: Save, id: Item) {
  return !isShipScanner(id) || (state.scannerBlueprints?.includes(id) ?? false);
}

export function buyScannerBlueprint(state: Save, id: ShipScanner) {
  const spec = shipScanners[id];
  const station = systemAt(state.seed, state.systemX, state.systemY).station;
  if (state.mode !== "docked" || station?.kind !== spec.station)
    return "Este projeto é vendido em outro tipo de estação.";
  if (state.scannerBlueprints?.includes(id))
    return "Você já possui esse projeto.";
  if (state.credits < spec.price) return "Créditos insuficientes.";
  (state.scannerBlueprints ??= []).push(id);
  state.credits -= spec.price;
}

export interface ScannerContact {
  id: string;
  name: string;
  distance: number;
  cargo: Inventory;
  wanted: number;
}

export function scannerContacts(
  ship: Save["ship"],
  npcs: readonly SpaceNpc[],
): ScannerContact[] {
  return npcs
    .filter((npc) => npc.hull > 0)
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      distance: Math.hypot(npc.x - ship.x, npc.y - ship.y),
      cargo: npc.cargo,
      wanted: npc.wantedLevel ?? 0,
    }))
    .filter((contact) => contact.distance <= SHIP_SCAN_RANGE)
    .sort((a, b) => a.distance - b.distance);
}
