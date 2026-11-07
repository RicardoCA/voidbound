import type { Item } from "../game/types";
import type { Recipe } from "../crafting/recipes";

export const COOKING_TIME_MS = 10_000;
export const RAW_MEAT_RISK = 0.35;
export const FOOD_SICKNESS_DURATION = 30;

const nutrition: Partial<Record<Item, number>> = {
  basaltBerry: 18,
  amberFig: 18,
  frostPlum: 18,
  jadePear: 18,
  emberFruit: 18,
  tideMelon: 18,
  rawMeat: 8,
  cookedMeat: 35,
};

export function foodValue(item: Item) {
  return nutrition[item] ?? 0;
}

export const cookedMeatRecipe: Recipe = {
  id: "cookedMeat",
  cost: { rawMeat: 1 },
  unlock: 0,
};
