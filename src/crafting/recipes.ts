import type { Item, Inventory } from "../game/types";
import { add, consume } from "../inventory/inventory";
export interface Recipe {
  id: Item;
  cost: Inventory;
  unlock: number;
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
];
export function craft(
  inv: Inventory,
  recipe: Recipe,
  capacity: number,
  mission: number,
) {
  if (mission < recipe.unlock) return false;
  const draft = { ...inv };
  if (!consume(draft, recipe.cost) || !add(draft, recipe.id, 1, capacity))
    return false;
  for (const key of Object.keys(inv)) delete inv[key as Item];
  Object.assign(inv, draft);
  return true;
}
