import { splitMeat } from "../survival/perishables";
import { items, type Inventory, type Item } from "../game/types";
export function inventoryEntries(inv: Inventory): [Item, number][] {
  return Object.entries(inv).filter(
    (entry): entry is [Item, number] =>
      Object.hasOwn(items, entry[0]) && typeof entry[1] === "number",
  );
}
export function slots(inv: Inventory) {
  return inventoryEntries(inv).reduce(
    (sum, [id, n]) => sum + Math.ceil((n ?? 0) / items[id as Item].stack),
    0,
  );
}
export function add(inv: Inventory, id: Item, n: number, capacity = 24) {
  if (!Number.isInteger(n) || n <= 0) return false;
  const next = { ...inv, [id]: (inv[id] ?? 0) + n };
  if (slots(next) > capacity) return false;
  inv[id] = (inv[id] ?? 0) + n;
  return true;
}
export function consume(inv: Inventory, cost: Inventory) {
  if (
    !inventoryEntries(cost).every(
      ([id, n]) =>
        Number.isInteger(n) && n! > 0 && (inv[id as Item] ?? 0) >= n!,
    )
  )
    return false;
  if (cost.rawMeat && inv.meatBatches) {
    const { rest } = splitMeat(inv, cost.rawMeat);
    if (rest.length) inv.meatBatches = rest;
    else delete inv.meatBatches;
  }
  for (const [id, n] of inventoryEntries(cost)) {
    inv[id as Item]! -= n!;
    if (inv[id as Item] === 0) delete inv[id as Item];
  }
  return true;
}
