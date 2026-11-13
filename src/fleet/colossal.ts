import type { Inventory, Save, ShipIdentity } from "../game/types";
import { consume } from "../inventory/inventory";

export interface Colossal {
  stage: number;
  sector: { x: number; y: number };
  x: number;
  y: number;
  slots: number;
  ships: string[];
  aboard?: ShipIdentity["id"];
  fuel: number;
  warp: number;
}

export const colossalStages: { name: string; cost: Inventory }[] = [
  {
    name: "Estrutura orbital",
    cost: { plate: 500, titanium: 250, circuit: 100 },
  },
  {
    name: "Casco e hangar",
    cost: { plate: 700, titanium: 350, circuit: 180, cell: 80 },
  },
  {
    name: "Ponte e motor de dobra",
    cost: { titanium: 450, circuit: 220, cell: 160, crystal: 200 },
  },
];
export const bayCost = { plate: 250, titanium: 100, circuit: 60 };
export const COLOSSAL_RANGE = 40;
export const COLOSSAL_EXIT = 210;

export function colossalHere(state: Save) {
  const ship = state.colossal;
  return ship?.sector.x === state.systemX && ship.sector.y === state.systemY
    ? ship
    : undefined;
}

export function buildColossal(state: Save, x: number, y: number) {
  if (state.mode !== "docked") return "Use a oficina de uma estação.";
  const current = state.colossal;
  if (current && !colossalHere(state)) return "Volte ao sistema do estaleiro.";
  const recipe = colossalStages[current?.stage ?? 0];
  if (!recipe) return "A nave colossal já está pronta.";
  if (!consume(state.inventory, recipe.cost))
    return "Faltam materiais na carga.";
  const ship = (state.colossal ??= {
    stage: 0,
    sector: { x: state.systemX, y: state.systemY },
    x,
    y,
    slots: 1,
    ships: [],
    fuel: 0,
    warp: 0,
  });
  ship.stage++;
}

export function parkColossal(state: Save) {
  const ship = colossalHere(state);
  if (
    state.mode !== "space" ||
    !ship ||
    ship.stage < 3 ||
    Math.hypot(ship.x - state.ship.x, ship.y - state.ship.y) > 190 ||
    Math.hypot(state.ship.vx, state.ship.vy) > 35
  )
    return "Aproxime-se da colossal e freie até 35 km/s.";
  if (ship.ships.length + 1 > ship.slots) return "Hangar sem vaga.";
  ship.aboard = state.activeShip.id;
  state.ship.vx = state.ship.vy = 0;
}

export function addColossalBay(state: Save) {
  if (!state.colossal?.aboard) return "Embarque na colossal.";
  if (!consume(state.inventory, bayCost)) return "Faltam materiais na carga.";
  state.colossal.slots++;
}

export function loadColossalFuel(state: Save, item: "fuel" | "warpFuel") {
  const ship = colossalHere(state);
  if (!ship?.aboard) return "Embarque na colossal.";
  const amount = state.inventory[item] ?? 0;
  if (!amount || !consume(state.inventory, { [item]: amount }))
    return "Falta combustível na carga.";
  if (item === "fuel") ship.fuel += amount;
  else ship.warp += amount;
}

export function selectColossalShip(state: Save, id: string) {
  const carrier = colossalHere(state);
  const index = state.parkedShips.findIndex((ship) => ship.id === id);
  const next = state.parkedShips[index];
  if (!carrier?.aboard || !carrier.ships.includes(id) || !next || next.pilot)
    return "Esta nave precisa estar no hangar da colossal.";
  state.parkedShips[index] = {
    ...state.activeShip,
    location: { ...carrier.sector },
    ship: state.ship,
    inventory: state.inventory,
    upgrades: state.upgrades,
  };
  carrier.ships = carrier.ships.map((shipId) =>
    shipId === id ? state.activeShip.id : shipId,
  );
  state.activeShip = {
    id,
    model: next.model,
    ...(next.rescue && { rescue: true }),
  };
  state.ship = { ...next.ship, x: carrier.x, y: carrier.y, vx: 0, vy: 0 };
  state.inventory = next.inventory;
  state.upgrades = next.upgrades;
  carrier.aboard = id;
}

export function transferColossalShip(state: Save, id: string) {
  const carrier = colossalHere(state);
  const ship = state.parkedShips.find((entry) => entry.id === id);
  if (
    state.mode !== "docked" ||
    !carrier ||
    carrier.stage < 3 ||
    !ship ||
    ship.pilot ||
    ship.location.x !== state.systemX ||
    ship.location.y !== state.systemY
  )
    return "A nave e a colossal precisam estar disponíveis neste sistema.";
  if (carrier.ships.includes(id)) {
    carrier.ships = carrier.ships.filter((entry) => entry !== id);
    return;
  }
  if (carrier.ships.length >= carrier.slots) return "Hangar sem vaga.";
  carrier.ships.push(id);
}
