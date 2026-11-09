import { jurisdiction } from "./law";
import type { Inventory, Save, ShipModelId, StarSystem } from "../game/types";
import { hash } from "../game/procedural/random";
import { addBatch } from "../construction/building";
import { consume } from "../inventory/inventory";
import { awardCareerXP, careerLevel } from "../progression/careers";
import { systemAt } from "../universe/generator";

const trafficRoles = [
  "freighter",
  "miner",
  "escort",
  "pirate",
  "police",
  "bounty",
  "elite",
] as const;
export type TrafficRole = (typeof trafficRoles)[number];
export interface Point {
  x: number;
  y: number;
}
export interface SpaceNpc extends Point {
  id: string;
  role: TrafficRole;
  name: string;
  faction: string;
  assaultReported?: boolean;
  model: ShipModelId;
  angle: number;
  vx: number;
  vy: number;
  home: Point;
  hull: number;
  maxHull: number;
  shield: number;
  cargo: Inventory;
  engaged: boolean;
  fireAt: number;
}

export interface FlightContact {
  name: string;
  distance: number;
  bearing: string;
  wreck: boolean;
  hull?: number;
  shield?: number;
}

export interface Wreck extends Point {
  id: string;
  systemId: string;
  name: string;
  cargo: Inventory;
  recovered: boolean;
}

export interface Piracy {
  wrecks: Record<string, Wreck>;
  recovered: number;
  sold: number;
}

export function hasBlackMarket(system: StarSystem) {
  return Boolean(
    system.station &&
    ((system.x === 0 && system.y === 0) ||
      hash(`${system.id}:black-market`) % 3 === 0),
  );
}

export function blackMarketPrice(state: Save) {
  const level = careerLevel(
    "pirate",
    state.progression.careers.pirate.xp,
  ).level;
  return 850 + (level - 1) * 10;
}

export function sellContraband(state: Save, amount: number) {
  const system = systemAt(state.seed, state.systemX, state.systemY);
  if (state.mode !== "docked" || !hasBlackMarket(system))
    return "Procure uma estação com mercado clandestino.";
  if (!Number.isSafeInteger(amount) || amount <= 0)
    return "Escolha uma quantidade inteira positiva.";
  const balance = state.credits + blackMarketPrice(state) * amount;
  if (!Number.isSafeInteger(balance)) return "Limite de créditos atingido.";
  if (!consume(state.inventory, { sealedCargo: amount }))
    return "Contrabando insuficiente na carga.";
  state.credits = balance;
  state.progression.piracy.sold += amount;
  awardCareerXP(
    state.progression,
    "pirate",
    25 * amount,
    "Venda clandestina",
    state.time,
  );
}

export function trafficFor(system: StarSystem, piracy: Piracy): SpaceNpc[] {
  const seed = hash(`${system.id}:traffic`);
  const roles: {
    role: TrafficRole;
    name: string;
    model: ShipModelId;
    x: number;
    y: number;
    hull: number;
    shield: number;
    cargo: Inventory;
  }[] = [
    {
      role: "freighter",
      name: "Cargueiro comercial",
      model: "atlas",
      x: 430,
      y: 115,
      hull: 64,
      shield: 12,
      cargo: { sealedCargo: 3 + (seed % 3), copper: 8 },
    },
    {
      role: "miner",
      name: "Mineradora independente",
      model: "titan",
      x: 880,
      y: 550,
      hull: 78,
      shield: 0,
      cargo: { sealedCargo: 2, titanium: 5 },
    },
    {
      role: "escort",
      name: "Escolta comercial",
      model: "bastion",
      x: 585,
      y: 63,
      hull: 88,
      shield: 28,
      cargo: { sealedCargo: 2, iron: 10 },
    },
    {
      role: "pirate",
      name: "Corsário errante",
      model: "viper",
      x: 1180,
      y: -250,
      hull: 55,
      shield: 18,
      cargo: { sealedCargo: 3, crystal: 4 },
    },
  ];
  return roles.flatMap(({ hull, ...entry }) => {
    if (entry.role === "pirate" && !hasBlackMarket(system)) return [];
    const id = `${system.id}:traffic:${entry.role}`;
    if (piracy.wrecks[id]) return [];
    const x = entry.x + (seed % 50),
      y = entry.y;
    return [
      {
        ...entry,
        id,
        x,
        y,
        home: { x, y },
        hull,
        maxHull: hull,
        vx: 0,
        vy: 0,
        angle: 0,
        faction:
          entry.role === "pirate" || entry.role === "miner"
            ? "Independentes"
            : "Consórcio de Trânsito",
        engaged: false,
        fireAt: 0,
      },
    ];
  });
}

export function enforcementNpc(
  system: StarSystem,
  piracy: Piracy,
  role: "police" | "bounty" | "elite",
  home: Point,
): SpaceNpc | undefined {
  const id = `${system.id}:traffic:${role}`;
  if (piracy.wrecks[id]) return;
  const profile = {
    police: { name: "Patrulha policial", model: "viper", hull: 72, shield: 25 },
    bounty: {
      name: "Caçador de recompensa",
      model: "viper",
      hull: 96,
      shield: 30,
    },
    elite: {
      name: "Interceptor de elite",
      model: "bastion",
      hull: 125,
      shield: 46,
    },
  } as const;
  return {
    ...profile[role],
    id,
    role,
    ...home,
    home,
    maxHull: profile[role].hull,
    faction: jurisdiction(system).faction,
    angle: 0,
    vx: 0,
    vy: 0,
    fireAt: 0,
    cargo: { iron: 3 },
    engaged: false,
  };
}

export function hitNpc(
  state: Save,
  system: StarSystem,
  npc: SpaceNpc,
  damage: number,
  shieldMultiplier = 1,
) {
  const piracy = state.progression.piracy;
  if (
    piracy.wrecks[npc.id] ||
    npc.hull <= 0 ||
    !Number.isFinite(damage) ||
    damage <= 0
  )
    return;
  npc.engaged = true;
  const absorbed = Math.min(npc.shield, damage * shieldMultiplier);
  npc.shield -= absorbed;
  npc.hull = Math.max(0, npc.hull - (damage - absorbed / shieldMultiplier));
  if (npc.hull > 0) return;
  const wreck: Wreck = {
    id: npc.id,
    systemId: system.id,
    name: npc.name,
    x: npc.x,
    y: npc.y,
    cargo: { ...npc.cargo },
    recovered: false,
  };
  piracy.wrecks[npc.id] = wreck;
  return wreck;
}

export function systemWrecks(systemId: string, piracy: Piracy) {
  return trafficRoles.flatMap((role) => {
    const wreck = piracy.wrecks[`${systemId}:traffic:${role}`];
    return wreck && !wreck.recovered ? [wreck] : [];
  });
}

export const SALVAGE_RANGE = 95;
export function salvage(state: Save, wreck: Wreck, capacity: number) {
  const stored = state.progression.piracy.wrecks[wreck.id];
  if (
    state.mode !== "space" ||
    !stored ||
    stored.recovered ||
    stored.systemId !== systemAt(state.seed, state.systemX, state.systemY).id ||
    Math.hypot(state.ship.x - stored.x, state.ship.y - stored.y) > SALVAGE_RANGE
  )
    return "Aproxime-se de um destroço com carga.";
  if (Math.hypot(state.ship.vx, state.ship.vy) > 50)
    return "Freie até 50 km/s para recolher a carga.";
  if (!addBatch(state.inventory, stored.cargo, capacity))
    return "Carga cheia. Libere espaço para o saque.";
  stored.recovered = true;
  stored.cargo = {};
  state.progression.piracy.recovered++;
  awardCareerXP(
    state.progression,
    "pirate",
    160,
    `Carga recuperada · ${stored.name}`,
    state.time,
  );
}
