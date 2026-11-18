import type { Inventory, PlacedPiece, Save } from "../game/types";
import { add, consume } from "../inventory/inventory";
import { transfer } from "../construction/building";
export const OXYGEN_CARTRIDGE_CAPACITY = 10;
export const OXYGEN_FILL_TIME_MS = 10_000;
/** Treat missing state from a live update as idle, never NaN or busy. */
export function oxygenFillingProgress(elapsed: unknown) {
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0)
    return null;
  const value = Math.min(OXYGEN_FILL_TIME_MS, elapsed);
  return {
    elapsed: value,
    percent: Math.floor((100 * value) / OXYGEN_FILL_TIME_MS),
    seconds: Math.ceil((OXYGEN_FILL_TIME_MS - value) / 1000),
  };
}
export function cartridgeCount(inventory: Inventory) {
  return (
    (inventory.oxygenCartridge ?? 0) + (inventory.emptyOxygenCartridge ?? 0)
  );
}
export function loadCartridges(
  source: Inventory,
  destination: Inventory,
  quantity: number,
) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    cartridgeCount(destination) + quantity > OXYGEN_CARTRIDGE_CAPACITY
  )
    return false;
  return transfer(source, destination, "oxygenCartridge", quantity, 2);
}
/** Commit the inventory and generator resource together, or change neither. */
export function fillCartridge(
  inventory: Inventory,
  capacity: number,
  generator: PlacedPiece,
  battery?: PlacedPiece,
) {
  if (
    generator.kind !== "oxygenGenerator" &&
    generator.kind !== "planetaryOxygenGenerator"
  )
    return false;
  const planetary = generator.kind === "planetaryOxygenGenerator";
  if (
    planetary
      ? !generator.powered ||
        battery?.kind !== "battery" ||
        (battery.energy ?? 0) < 10
      : (generator.oxygen ?? 0) < 100
  )
    return false;
  const next = { ...inventory };
  if (
    !consume(next, { emptyOxygenCartridge: 1 }) ||
    !add(next, "oxygenCartridge", 1, capacity)
  )
    return false;
  Object.assign(inventory, { emptyOxygenCartridge: 0 }, next);
  if (!next.emptyOxygenCartridge) delete inventory.emptyOxygenCartridge;
  if (planetary) battery!.energy! -= 10;
  else generator.oxygen! -= 100;
  return true;
}
export function refillAutomatically(player: Save["player"]) {
  const cartridges = player.autoOxygen?.cartridges;
  if (
    !cartridges ||
    player.health <= 0 ||
    player.oxygen >= 30 ||
    !consume(cartridges, { oxygenCartridge: 1 })
  )
    return false;
  cartridges.emptyOxygenCartridge = (cartridges.emptyOxygenCartridge ?? 0) + 1;
  player.oxygen = 100;
  return true;
}
