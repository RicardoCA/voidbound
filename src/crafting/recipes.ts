import { facilityDefinitions, type FacilityKind } from "../construction/facilityTypes";
import { scannerIds, shipScanners } from "../combat/shipScanners";
import { weaponModules, type WeaponModule } from "../combat/weapons";
import {
  crystalFor,
  deflectorFor,
  saberFor,
  starKinds,
} from "../universe/stars";
import type { Item, Inventory } from "../game/types";
import { add, consume } from "../inventory/inventory";
export interface Recipe {
  id: Item;
  cost: Inventory;
  unlock: number;
  amount?: number;
  station?: "ship" | "hand" | "bench";
}
export const recipes: Recipe[] = [
  { id: "plate", cost: { iron: 3 }, unlock: 0 },
  { id: "circuit", cost: { copper: 2, silicon: 1 }, unlock: 0 },
  { id: "cell", cost: { crystal: 2, copper: 1 }, unlock: 0 },
  { id: "emptyOxygenCartridge", cost: { plate: 4 }, unlock: 0 },
  { id: "autoOxygen", cost: { plate: 3, circuit: 2, cell: 1 }, unlock: 0 },
  { id: "autoFeeder", cost: { plate: 3, circuit: 2, cell: 1 }, unlock: 0 },
  { id: "repair", cost: { plate: 2, circuit: 1 }, unlock: 0 },
  { id: "oxygen", cost: { plate: 2, silicon: 1 }, unlock: 0 },
  { id: "warpFuel", cost: { fuel: 2, silicon: 3 }, unlock: 0, amount: 4 },
  { id: "fuel", cost: { rawFuel: 3 }, unlock: 0 },
  { id: "engine", cost: { plate: 5, circuit: 3, cell: 2 }, unlock: 4 },
  { id: "laser", cost: { titanium: 3, circuit: 2, crystal: 2 }, unlock: 4 },
  { id: "tank", cost: { plate: 3, circuit: 1 }, unlock: 4 },
  { id: "shield", cost: { plate: 3, cell: 2 }, unlock: 4 },
  { id: "cargo", cost: { plate: 4, circuit: 1 }, unlock: 4 },
  { id: "jump", cost: { plate: 2, circuit: 2, crystal: 2 }, unlock: 4 },
  { id: "drill", cost: { titanium: 2, circuit: 1 }, unlock: 4 },
  ...(Object.keys(weaponModules) as WeaponModule[]).map((id): Recipe => ({
    id,
    cost: weaponModules[id].cost,
    unlock: 0,
    station: "ship",
  })),
  ...scannerIds.map((id): Recipe => ({
    id,
    cost: shipScanners[id].cost,
    unlock: 0,
    station: "ship",
  })),
  ...starKinds.map((kind): Recipe => ({
    id: saberFor(kind),
    cost: { [crystalFor(kind)]: 1, circuit: 1, titanium: 10 },
    unlock: 0,
    station: "ship",
  })),
  ...starKinds.map((kind): Recipe => ({
    id: deflectorFor(kind),
    cost:
      kind === "neutron"
        ? { plate: 4, circuit: 3, titanium: 3, cell: 2 }
        : {
            plate: 3,
            circuit: 2,
            cell: 1,
            ...(kind === "blue" || kind === "giant" ? { titanium: 2 } : {}),
          },
    unlock: 0,
    station: "ship",
  })),
  ...Object.entries(facilityDefinitions).map(([id, definition]): Recipe => ({ id: id as FacilityKind, cost: definition.cost, unlock: 0, station: "bench" })),
  { id: "bucket", cost: { iron: 3 }, unlock: 0, station: "hand" },
  { id: "stick", cost: { wood: 1 }, amount: 8, unlock: 0, station: "ship" },
  { id: "woodBlock", cost: { wood: 2 }, unlock: 0, amount: 4, station: "bench" },
  { id: "modularElevator", cost: { iron: 4, copper: 2 }, amount: 2, unlock: 0, station: "bench" },
  { id: "cropRoof", cost: { wood: 2, silicon: 1 }, unlock: 0, amount: 4, station: "bench" },
  { id: "woodFence", cost: { wood: 2 }, unlock: 0, amount: 4, station: "bench" },
  { id: "fenceGate", cost: { wood: 2, iron: 1 }, unlock: 0, station: "bench" },
  {
    id: "stoneWall",
    cost: { stone: 3 },
    amount: 4,
    unlock: 0,
    station: "bench",
  },
  {
    id: "metalWall",
    cost: { plate: 2 },
    amount: 4,
    unlock: 0,
    station: "bench",
  },
  {
    id: "fridge",
    cost: { plate: 3, circuit: 2, cell: 1 },
    unlock: 0,
    station: "bench",
  },
  { id: "picture", cost: { wood: 2, fiber: 1 }, unlock: 0, station: "bench" },
  { id: "table", cost: { wood: 4, stick: 2 }, unlock: 0, station: "bench" },
  { id: "bed", cost: { wood: 5, fiber: 3 }, unlock: 0, station: "bench" },
  { id: "woodWall", cost: { wood: 2 }, unlock: 0, amount: 4, station: "bench" },
  {
    id: "woodStairs",
    cost: { wood: 3 },
    unlock: 0,
    amount: 4,
    station: "bench",
  },
  { id: "stickLadder", cost: { stick: 4 }, unlock: 0, station: "bench" },
  { id: "woodHatch", cost: { wood: 3, iron: 1 }, unlock: 0, station: "bench" },
  { id: "cabinet", cost: { wood: 6, iron: 2 }, unlock: 0, station: "bench" },
  {
    id: "cabinetDouble",
    cost: { wood: 12, iron: 4 },
    unlock: 0,
    station: "bench",
  },
  {
    id: "cabinetTriple",
    cost: { wood: 18, iron: 6 },
    unlock: 0,
    station: "bench",
  },
  { id: "campfire", cost: { wood: 4, iron: 2 }, unlock: 0, station: "bench" },
  { id: "medicalSupplies", cost: { fiber: 2, carbon: 1, silicon: 1 }, unlock: 0, station: "bench" },
  { id: "infirmary", cost: { plate: 5, circuit: 2, silicon: 3 }, unlock: 0, station: "bench" },
  { id: "workbench", cost: { stone: 30, wood: 50, iron: 100 }, unlock: 0, station: "bench" },
  { id: "floodlight", cost: { plate: 2, copper: 2, circuit: 1, crystal: 1 }, unlock: 0, station: "bench" },
  { id: "emergencyLight", cost: { plate: 1, circuit: 1, cell: 1 }, unlock: 0, station: "bench" },
  { id: "window", cost: { silicon: 2, plate: 1 }, unlock: 0, station: "bench" },
  { id: "airlockDoor", cost: { plate: 4, circuit: 1 }, unlock: 0, station: "bench" },
  { id: "woodDoor", cost: { wood: 4, iron: 1 }, unlock: 0, station: "bench" },
  {
    id: "solarPanel",
    cost: { plate: 1, copper: 2, silicon: 3 },
    unlock: 0,
    station: "bench",
  },
  {
    id: "battery",
    cost: { plate: 2, circuit: 1, cell: 2 },
    unlock: 0,
    station: "bench",
  },
  {
    id: "planetaryOxygenGenerator",
    cost: { oxygenGenerator: 1, plate: 12, circuit: 6, cell: 4 },
    unlock: 0,
    station: "bench",
  },
  {
    id: "oxygenGenerator",
    cost: { plate: 3, circuit: 2, cell: 1 },
    unlock: 0,
    station: "bench",
  },
];
export function craft(
  inv: Inventory,
  recipe: Recipe,
  capacity: number,
  mission: number,
) {
  if (mission < recipe.unlock) return false;
  const draft = { ...inv };
  if (
    !consume(draft, recipe.cost) ||
    !add(draft, recipe.id, recipe.amount ?? 1, capacity)
  )
    return false;
  for (const key of Object.keys(inv))
    if (!Object.hasOwn(draft, key)) delete inv[key as Item];
  Object.assign(inv, draft);
  return true;
}
