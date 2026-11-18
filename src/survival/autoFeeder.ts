import type { Inventory, Item, Save } from "../game/types";
import { inventoryEntries, consume } from "../inventory/inventory";
import { transfer } from "../construction/building";
import { foodValue, RAW_MEAT_RISK, FOOD_SICKNESS_DURATION } from "./food";

export const FEEDER_CAPACITY = 100;
export function feederCount(food: Inventory) {
  return inventoryEntries(food).reduce((total, [, n]) => total + n, 0);
}
/** One food type per slot; transfer preserves the original meat expiry. */
export function loadFeeder(
  source: Inventory,
  food: Inventory,
  item: Item,
  amount: number,
) {
  if (
    !foodValue(item) ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    feederCount(food) + amount > FEEDER_CAPACITY ||
    inventoryEntries(food).some(([id, n]) => n > 0 && id !== item)
  )
    return false;
  return transfer(source, food, item, amount, FEEDER_CAPACITY);
}
export function feedAutomatically(
  player: Save["player"],
  random = Math.random,
) {
  const food = player.autoFeeder?.food;
  if (!food || player.health <= 0 || player.hunger >= 30) return 0;
  let eaten = 0;
  for (const [item] of inventoryEntries(food)) {
    const nutrition = foodValue(item);
    if (!nutrition) continue;
    while (player.hunger < 100 && consume(food, { [item]: 1 })) {
      player.hunger = Math.min(100, player.hunger + nutrition);
      if (item === "rawMeat" && random() < RAW_MEAT_RISK)
        player.sickness = FOOD_SICKNESS_DURATION;
      eaten++;
    }
  }
  return eaten;
}
