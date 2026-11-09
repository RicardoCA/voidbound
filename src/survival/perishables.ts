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

export function meatShelfLife(
  inventory: Inventory,
  time: number,
  inFridge = false,
) {
  if (!inventory.rawMeat) return;
  const deadline = inFridge ? 0 : time;
  const expires = (inventory.meatBatches ?? []).reduce(
    (earliest, batch) => Math.min(earliest, batch.expires),
    deadline + PLANET_DAY,
  );
  const remaining = Math.max(0, Math.min(PLANET_DAY, expires - deadline));
  const minutes = Math.max(
    1,
    Math.ceil((remaining / PLANET_DAY) * 24 * 60 - 1e-9),
  );
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return {
    percent: Math.round((remaining / PLANET_DAY) * 100),
    label:
      remaining === 0
        ? "Vencida"
        : hours
          ? `${hours} h ${String(remainder).padStart(2, "0")} min`
          : `${minutes} min`,
  };
}
