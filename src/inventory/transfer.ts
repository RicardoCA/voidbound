import { items, type Inventory, type Item } from "../game/types";
import { inventoryEntries, slots } from "./inventory";

/** Includes room in the last stack even when every slot is occupied. */
export function transferable(
  source: Inventory,
  destination: Inventory,
  id: Item,
  capacity: number,
  requested = Infinity,
) {
  const count = source[id] ?? 0;
  if (
    source === destination ||
    count <= 0 ||
    requested <= 0 ||
    Number.isNaN(requested)
  )
    return 0;
  const present = destination[id] ?? 0;
  const stack = items[id].stack;
  const room =
    Math.max(0, capacity - slots(destination)) * stack +
    (present % stack ? stack - (present % stack) : 0);
  return Math.max(0, Math.min(count, Math.floor(requested), room));
}

export function transferList(
  source: Inventory,
  destination: Inventory,
  similar = false,
) {
  return inventoryEntries(source).filter(
    ([id, count]) => count > 0 && (!similar || (destination[id] ?? 0) > 0),
  );
}
