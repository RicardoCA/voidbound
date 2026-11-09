import type { Item, Inventory } from "../game/types";
import { add, consume } from "../inventory/inventory";
export interface Recipe {
  id: Item;
  cost: Inventory;
  unlock: number;
  amount?: number;
  station?: "ship" | "hand";
}
export const recipes: Recipe[] = [
  { id: "plate", cost: { iron: 3 }, unlock: 0 },
  { id: "circuit", cost: { copper: 2, silicon: 1 }, unlock: 0 },
  { id: "cell", cost: { crystal: 2, copper: 1 }, unlock: 0 },
  { id: "repair", cost: { plate: 2, circuit: 1 }, unlock: 0 },
  { id: "oxygen", cost: { plate: 2, silicon: 1 }, unlock: 0 },
  { id: "fuel", cost: { rawFuel: 3 }, unlock: 0 },
  { id: "engine", cost: { plate: 5, circuit: 3, cell: 2 }, unlock: 4 },
  { id: "laser", cost: { titanium: 3, circuit: 2, crystal: 2 }, unlock: 4 },
  { id: "tank", cost: { plate: 3, circuit: 1 }, unlock: 4 },
  { id: "shield", cost: { plate: 3, cell: 2 }, unlock: 4 },
  { id: "cargo", cost: { plate: 4, circuit: 1 }, unlock: 4 },
  { id: "jump", cost: { plate: 2, circuit: 2, crystal: 2 }, unlock: 4 },
  { id: "drill", cost: { titanium: 2, circuit: 1 }, unlock: 4 },
  { id: "woodBlock", cost: { wood: 2 }, unlock: 0, amount: 4, station: "hand" },
  { id: "woodWall", cost: { wood: 2 }, unlock: 0, amount: 4, station: "hand" },
  {
    id: "woodStairs",
    cost: { wood: 3 },
    unlock: 0,
    amount: 4,
    station: "hand",
  },
  { id: "cabinet", cost: { wood: 6, iron: 2 }, unlock: 0, station: "hand" },
  {
    id: "cabinetDouble",
    cost: { wood: 12, iron: 4 },
    unlock: 0,
    station: "hand",
  },
  {
    id: "cabinetTriple",
    cost: { wood: 18, iron: 6 },
    unlock: 0,
    station: "hand",
  },
  { id: "campfire", cost: { wood: 4, iron: 2 }, unlock: 0, station: "hand" },
  { id: "woodDoor", cost: { wood: 4, iron: 1 }, unlock: 0, station: "hand" },
  {
    id: "solarPanel",
    cost: { plate: 1, copper: 2, silicon: 3 },
    unlock: 0,
    station: "hand",
  },
  {
    id: "battery",
    cost: { plate: 2, circuit: 1, cell: 2 },
    unlock: 0,
    station: "hand",
  },
  {
    id: "oxygenGenerator",
    cost: { plate: 3, circuit: 2, cell: 1 },
    unlock: 0,
    station: "hand",
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
  for (const key of Object.keys(inv)) delete inv[key as Item];
  Object.assign(inv, draft);
  return true;
}
