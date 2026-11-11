import type { Inventory, Save, Station } from "../game/types";
import { consume, inventoryEntries } from "../inventory/inventory";
import { systemAt } from "../universe/generator";
import { registerShip } from "./hangar";

export const shipBlueprints = {
  lumen: {
    station: "standard",
    price: 55_000,
    materials: {
      plate: 280,
      titanium: 160,
      silicon: 220,
      circuit: 100,
      cell: 65,
      crystal: 115,
    },
  },
  strata: {
    station: "standard",
    price: 65_000,
    materials: {
      plate: 420,
      titanium: 220,
      iron: 360,
      carbon: 200,
      circuit: 90,
      cell: 80,
    },
  },
  corvus: {
    station: "clandestine",
    price: 80_000,
    materials: {
      plate: 320,
      titanium: 300,
      copper: 240,
      circuit: 150,
      cell: 110,
      crystal: 180,
    },
  },
} satisfies Record<
  string,
  { station: Station["kind"]; price: number; materials: Inventory }
>;

export type SpecialShip = keyof typeof shipBlueprints;

export function buyShipBlueprint(state: Save, id: SpecialShip) {
  const spec = shipBlueprints[id];
  if (
    !spec ||
    state.mode !== "docked" ||
    systemAt(state.seed, state.systemX, state.systemY).station?.kind !==
      spec.station
  )
    return "Este projeto é vendido em outro tipo de estação.";
  if (state.shipBlueprints?.includes(id)) return "Você já possui esse projeto.";
  if (state.credits < spec.price) return "Créditos insuficientes.";
  (state.shipBlueprints ??= []).push(id);
  state.credits -= spec.price;
}

export function craftSpecialShip(state: Save, id: SpecialShip) {
  const spec = shipBlueprints[id];
  if (
    !spec ||
    state.mode !== "docked" ||
    systemAt(state.seed, state.systemX, state.systemY).station?.kind !==
      spec.station
  )
    return "Esta nave precisa ser montada na oficina do tipo de estação indicado.";
  if (!state.shipBlueprints?.includes(id)) return "Adquira o projeto primeiro.";
  if (
    inventoryEntries(spec.materials).some(
      ([item, count]) => (state.inventory[item] ?? 0) < count,
    )
  )
    return "Faltam materiais na carga da nave.";
  const error = registerShip(state, id);
  if (error) return error;
  consume(state.inventory, spec.materials);
}
