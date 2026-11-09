import { shipCapacity } from "../fleet/hangar";
import type { Save } from "../game/types";
import { add } from "../inventory/inventory";
import { systemAt } from "../universe/generator";
import { restrictedArms, type RestrictedWeapon } from "./weapons";

export function buyRestrictedArms(
  state: Save,
  id: RestrictedWeapon,
  product: "weapon" | "recipe",
) {
  const station = systemAt(state.seed, state.systemX, state.systemY).station;
  if (state.mode !== "docked" || station?.kind !== "clandestine")
    return "Procure o armeiro de uma estação clandestina.";

  const blueprint = product === "recipe";
  const price = blueprint
    ? restrictedArms[id].recipePrice
    : restrictedArms[id].weaponPrice;
  if (blueprint && state.weaponBlueprints?.includes(id))
    return "Você já possui esse projeto.";
  if (state.credits < price) return "Créditos insuficientes.";
  if (blueprint) (state.weaponBlueprints ??= []).push(id);
  else if (
    !add(
      state.inventory,
      id,
      1,
      shipCapacity(state.activeShip.model, state.upgrades),
    )
  )
    return "Libere um slot na carga da nave.";
  state.credits -= price;
}
