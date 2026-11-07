import type { ParkedShip, PilotTrip, Save } from "../game/types";
import { add, consume } from "../inventory/inventory";
import { marketItems, marketPrice, marketStock } from "../economy/market";
import { hash } from "../game/procedural/random";
import { nearby, systemAt } from "../universe/generator";
import { inLocalHangar, shipCapacity, shipFuelCapacity } from "./hangar";

export const PILOT_HIRE_PRICE = 100;
type RouteOrder = Pick<
  PilotTrip,
  "destination" | "item" | "quantity" | "repeat"
>;

function localShip(state: Save, id: string) {
  if (state.mode !== "docked") return;
  return state.parkedShips.find(
    (ship) => ship.id === id && inLocalHangar(state, ship),
  );
}

export function hirePilot(state: Save, id: string) {
  const ship = localShip(state, id);
  if (!ship || ship.pilot) return "Selecione uma nave livre neste hangar.";
  if (state.credits < PILOT_HIRE_PRICE)
    return "Saldo insuficiente para contratar.";
  const names = [
    "Ada Vale",
    "Iara Vega",
    "Noa Sato",
    "Lina Voss",
    "Kai Sol",
    "Milo Tan",
  ];
  ship.pilot = { name: names[hash(`${state.seed}:${id}`) % names.length]! };
  state.credits -= PILOT_HIRE_PRICE;
}

export function dismissPilot(state: Save, id: string) {
  const ship = localShip(state, id);
  if (!ship?.pilot || ship.pilot.trip)
    return "O piloto precisa estar livre neste hangar.";
  delete ship.pilot;
}

export function routeDestinations(state: Save, ship: ParkedShip) {
  const { x, y } = ship.location;
  const range = ship.upgrades.includes("engine") ? 4 : 2;
  return nearby(state.seed, x, y, range).filter((system) => {
    const distance = Math.hypot(system.x - x, system.y - y);
    return system.station && distance > 0 && distance <= range;
  });
}

export function routeQuote(ship: ParkedShip, order: RouteOrder) {
  if (
    !marketItems.includes(order.item) ||
    !Number.isSafeInteger(order.quantity) ||
    order.quantity < 1
  )
    return;
  const distance = Math.hypot(
    order.destination.x - ship.location.x,
    order.destination.y - ship.location.y,
  );
  const fuel = 2 * Math.ceil(distance * 8);
  const freight = 10 + fuel * 2;
  const unitCost = marketPrice(order.item, "buy");
  const cost = unitCost * order.quantity + freight;
  const payment = Math.ceil(unitCost * 1.35) * order.quantity;
  if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(payment)) return;
  return {
    cost,
    payment,
    profit: payment - cost,
    freight,
    fuel,
    duration: Math.ceil(35 + distance * 25),
  };
}

function dispatch(state: Save, ship: ParkedShip, order: RouteOrder) {
  const origin = systemAt(state.seed, ship.location.x, ship.location.y).station;
  const target = routeDestinations(state, ship).find(
    ({ x, y }) => x === order.destination.x && y === order.destination.y,
  );
  const quote = routeQuote(ship, order);
  if (!origin || !target?.station || !quote)
    return "Escolha uma estação no alcance e uma quantidade válida.";
  if (quote.fuel > shipFuelCapacity(ship.model, ship.upgrades))
    return "Tanque insuficiente para a rota.";
  if (state.credits < quote.cost)
    return "Saldo insuficiente para carga e frete.";
  const stock = marketStock(state, origin.id, order.item);
  if (stock < order.quantity) return "Estoque insuficiente na origem.";
  if (quote.profit <= 0)
    return "Aumente o lote para que a entrega cubra o frete.";
  if (
    !add(
      ship.inventory,
      order.item,
      order.quantity,
      shipCapacity(ship.model, ship.upgrades),
    )
  )
    return "A nave não tem espaço para este lote.";
  state.credits -= quote.cost;
  (state.marketStocks[origin.id] ??= {})[order.item] = stock - order.quantity;
  ship.pilot!.trip = {
    ...order,
    destination: { ...order.destination },
    returnsAt: state.time + quote.duration,
    payment: quote.payment,
  };
  delete ship.pilot!.message;
}

export function startPilotRoute(state: Save, id: string, order: RouteOrder) {
  const ship = localShip(state, id);
  if (!ship?.pilot || ship.pilot.trip)
    return "Selecione um piloto disponível no hangar local.";
  return dispatch(state, ship, order);
}

export function stopPilotRepeat(state: Save, id: string) {
  const trip = state.parkedShips.find((ship) => ship.id === id)?.pilot?.trip;
  if (state.mode !== "docked" || !trip?.repeat)
    return "Esta rota não tem repetição ativa.";
  trip.repeat = false;
}

/** Settle a delivery once, then attempt the next departure with current stocks and cash. */
export function advancePilotTrips(state: Save) {
  let changed = false;
  for (const ship of state.parkedShips) {
    const pilot = ship.pilot;
    const trip = pilot?.trip;
    if (!pilot || !trip || state.time < trip.returnsAt) continue;
    const station = systemAt(
      state.seed,
      trip.destination.x,
      trip.destination.y,
    ).station;
    const balance = state.credits + trip.payment;
    if (!station || !Number.isSafeInteger(balance)) continue;
    const stock = marketStock(state, station.id, trip.item) + trip.quantity;
    if (
      !Number.isSafeInteger(stock) ||
      !consume(ship.inventory, { [trip.item]: trip.quantity })
    )
      continue;

    state.credits = balance;
    (state.marketStocks[station.id] ??= {})[trip.item] = stock;
    delete pilot.trip;
    pilot.message = `Entrega concluída. +${trip.payment} CR recebidos.`;
    if (trip.repeat) {
      const error = dispatch(state, ship, trip);
      if (error) pilot.message += ` Rota interrompida. ${error}`;
    }
    changed = true;
  }
  return changed;
}
