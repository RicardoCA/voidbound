import type { Inventory, MeatBatch, Save } from "../game/types";
import { PLANET_DAY } from "../construction/habitat";

export function addMeatBatches(inventory: Inventory, batches: MeatBatch[]) {
  if (!batches.length) return;
  inventory.meatBatches = [...(inventory.meatBatches ?? []), ...batches].sort(
    (a, b) => a.expires - b.expires,
  );
}

export function splitMeat(inventory: Inventory, amount: number) {
  const taken: MeatBatch[] = [],
    rest: MeatBatch[] = [];
  for (const batch of inventory.meatBatches ?? []) {
    const count = Math.min(batch.amount, amount);
    if (count) taken.push({ ...batch, amount: count });
    if (count < batch.amount)
      rest.push({ ...batch, amount: batch.amount - count });
    amount -= count;
  }
  return { taken, rest };
}

function age(inventory: Inventory, time: number, chilled = false) {
  const amount = inventory.rawMeat ?? 0;
  if (!amount) return 0;
  const tracked = (inventory.meatBatches ?? []).reduce(
    (sum, batch) => sum + batch.amount,
    0,
  );
  if (tracked < amount)
    addMeatBatches(inventory, [
      {
        amount: amount - tracked,
        expires: chilled ? PLANET_DAY : time + PLANET_DAY,
      },
    ]);
  const deadline = chilled ? 0 : time;
  const batches = inventory.meatBatches ?? [];
  const spoiled = batches.reduce(
    (sum, batch) => sum + (batch.expires <= deadline ? batch.amount : 0),
    0,
  );
  if (spoiled > 0) {
    if (spoiled >= amount) {
      delete inventory.rawMeat;
      delete inventory.meatBatches;
    } else {
      inventory.rawMeat = amount - spoiled;
      inventory.meatBatches = batches.filter(
        (batch) => batch.expires > deadline,
      );
    }
  }
  return spoiled;
}

export function spoilMeat(save: Save) {
  let spoiled = age(save.inventory, save.time) + age(save.backpack, save.time);
  for (const ship of save.parkedShips)
    spoiled += age(ship.inventory, save.time);
  for (const settlement of Object.values(save.settlements))
    for (const [key, inventory] of Object.entries(settlement.cabinets))
      spoiled += age(
        inventory,
        save.time,
        settlement.pieces[key]?.kind === "fridge",
      );
  return spoiled;
}
