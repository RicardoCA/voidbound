import { items, type Inventory, type Item } from "../game/types";
export function slots(inv: Inventory) {
  return Object.entries(inv).reduce(
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
    !Object.entries(cost).every(
      ([id, n]) =>
        Number.isInteger(n) && n! > 0 && (inv[id as Item] ?? 0) >= n!,
    )
  )
    return false;
  for (const [id, n] of Object.entries(cost)) {
    inv[id as Item]! -= n!;
    if (inv[id as Item] === 0) delete inv[id as Item];
  }
  return true;
}
