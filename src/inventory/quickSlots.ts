import { isBuildItem } from "../construction/building";
import { tileForItem } from "../game/procedural/terrain";
import type { Item, Save } from "../game/types";
import { isPhotonSaber } from "../universe/stars";
import { isSeed } from "../survival/seedCatalog";

export const quickSlotNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const assignableQuickSlots = quickSlotNumbers.slice(1);

export function canAssignQuickSlot(item: Item) {
  return item === "bucket" || isSeed(item) || isBuildItem(item) || tileForItem(item) !== undefined || isPhotonSaber(item);
}

export function fillQuickSlot(state: Save, item: Item) {
  if (!canAssignQuickSlot(item) || (state.backpack[item] ?? 0) <= 0) return;
  const slots = state.quickSlots;
  if (assignableQuickSlots.some((number) => slots?.[number] === item)) return;
  const free = assignableQuickSlots.find((number) => !slots?.[number]);
  if (free !== undefined) (state.quickSlots ??= {})[free] = item;
}
