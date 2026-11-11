import type { Item, ParkedShip, Save, ShipModelId } from "../game/types";
import { transfer } from "../construction/building";
import { slots } from "../inventory/inventory";
import { shipBlueprints } from "./shipBlueprints";
import { shipModels } from "./models";

export function shipCapacity(model: ShipModelId, upgrades: readonly Item[]) {
  return shipModels[model].capacity + (upgrades.includes("cargo") ? 16 : 0);
}

export function shipFuelCapacity(
  model: ShipModelId,
  upgrades: readonly Item[],
) {
  return shipModels[model].fuel + (upgrades.includes("tank") ? 60 : 0);
}

export function inLocalHangar(state: Save, ship: ParkedShip) {
  return ship.location.x === state.systemX && ship.location.y === state.systemY;
}

export function resalePrice(ship: ParkedShip) {
  const model = shipModels[ship.model];
  return Math.floor(
    model.price *
      (0.25 + 0.35 * Math.max(0, Math.min(1, ship.ship.hull / model.hull))),
  );
}

export function buyShip(state: Save, modelId: ShipModelId) {
  const model = shipModels[modelId];
  if (state.mode !== "docked" || !Object.hasOwn(shipModels, modelId))
    return "Compre naves na concessionária de uma estação.";
  if (Object.hasOwn(shipBlueprints, modelId))
    return "Esta nave é fabricada na oficina.";
  if (state.credits < model.price)
    return "Saldo insuficiente para comprar a nave.";
  const error = registerShip(state, modelId);
  if (error) return error;
  state.credits -= model.price;
}

export function registerShip(state: Save, modelId: ShipModelId) {
  const model = shipModels[modelId];
  const serial = state.nextShipId,
    id = `ship-${serial}`;
  if (
    !Number.isSafeInteger(serial + 1) ||
    serial < 2 ||
    id === state.activeShip.id ||
    state.parkedShips.some((ship) => ship.id === id)
  )
    return "Não foi possível registrar uma nova nave.";
  state.parkedShips.push({
    id,
    model: modelId,
    location: { x: state.systemX, y: state.systemY },
    ship: {
      x: state.ship.x,
      y: state.ship.y,
      angle: 0,
      vx: 0,
      vy: 0,
      hull: model.hull,
      fuel: model.fuel,
      oxygen: 100,
      energy: 100,
    },
    inventory: {},
    upgrades: [...model.equipment],
  });
  state.nextShipId++;
}

export function activateShip(state: Save, id: string) {
  const index = state.parkedShips.findIndex((ship) => ship.id === id);
  const next = state.parkedShips[index];
  if (
    state.mode !== "docked" ||
    !next ||
    id === state.activeShip.id ||
    !inLocalHangar(state, next)
  )
    return "Esta nave precisa estar no hangar da estação atual.";
  if (next.pilot) return "Dispense o piloto antes de assumir esta nave.";
  state.parkedShips[index] = {
    ...state.activeShip,
    location: { x: state.systemX, y: state.systemY },
    ship: state.ship,
    inventory: state.inventory,
    upgrades: state.upgrades,
  };
  state.activeShip = {
    id: next.id,
    model: next.model,
    ...(next.rescue && { rescue: true }),
  };
  state.ship = { ...next.ship, x: state.ship.x, y: state.ship.y, vx: 0, vy: 0 };
  state.inventory = next.inventory;
  state.upgrades = next.upgrades;
}

export function sellShip(state: Save, id: string) {
  if (id === state.activeShip.id)
    return "Selecione outra nave como ativa antes de vender esta.";
  const index = state.parkedShips.findIndex((ship) => ship.id === id);
  const ship = state.parkedShips[index];
  if (state.mode !== "docked" || !ship || !inLocalHangar(state, ship))
    return "A nave só pode ser vendida no hangar onde está guardada.";
  if (ship.pilot) return "Dispense o piloto antes de vender esta nave.";
  if (slots(ship.inventory) > 0)
    return "Transfira a carga da nave antes de vender.";
  const balance = state.credits + resalePrice(ship);
  if (!Number.isSafeInteger(balance)) return "Limite de créditos atingido.";
  state.parkedShips.splice(index, 1);
  state.credits = balance;
}

export function transferShipCargo(
  state: Save,
  fromId: string,
  toId: string,
  item: Item,
  quantity: number,
) {
  function accessible(id: string) {
    if (id === state.activeShip.id)
      return {
        ...state.activeShip,
        inventory: state.inventory,
        upgrades: state.upgrades,
      };
    return state.parkedShips.find(
      (ship) =>
        ship.id === id && inLocalHangar(state, ship) && !ship.pilot?.trip,
    );
  }
  const from = accessible(fromId),
    to = accessible(toId);
  if (state.mode !== "docked" || !from || !to || fromId === toId)
    return "As duas naves precisam estar neste hangar.";
  if (
    !Number.isSafeInteger(quantity) ||
    !transfer(
      from.inventory,
      to.inventory,
      item,
      quantity,
      shipCapacity(to.model, to.upgrades),
    )
  )
    return "Confira a quantidade disponível e os slots livres no destino.";
}
