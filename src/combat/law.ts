import type { Save, StarSystem } from "../game/types";
import { hash } from "../game/procedural/random";
import { systemAt } from "../universe/generator";

export interface Crime {
  id: string;
  type: "assault" | "destruction";
  target: string;
  systemId: string;
  systemName: string;
  faction: string;
  shipId: string;
  time: number;
  severity: number;
  fine: number;
  bounty: number;
  detected: boolean;
  reported: boolean;
  paid: boolean;
}

export function jurisdiction(system: StarSystem) {
  const authorities = [
    "Consórcio de Trânsito",
    "Patrulha da Fronteira",
    "Aliança das Colônias",
    "Guarda Orbital",
  ];
  const region = hash(
    `${Math.floor(system.x / 4)}:${Math.floor(system.y / 4)}:authority`,
  );
  const security = 1 + (hash(`${system.id}:security`) % 3);
  return { faction: authorities[region % authorities.length]!, security };
}

export const wantedLabels = [
  "Limpo",
  "Suspeito",
  "Procurado",
  "Criminoso",
  "Inimigo Público",
  "Terror Galáctico",
];

function crimeAlert(crime: Crime, time: number) {
  return Math.max(
    0,
    crime.severity - Math.floor(Math.max(0, time - crime.time) / 240),
  );
}

export function wantedBySystem(state: Save) {
  const levels = new Map<string, number>();
  for (const crime of state.progression.crimes) {
    if (!crime.reported || crime.paid) continue;
    const alert = crimeAlert(crime, state.time);
    if (alert > 0)
      levels.set(
        crime.systemId,
        Math.min(5, (levels.get(crime.systemId) ?? 0) + alert),
      );
  }
  return levels;
}

export function wantedStatus(state: Save, system: StarSystem) {
  const authority = jurisdiction(system);
  let local = 0,
    fine = 0,
    bounty = 0,
    galacticBounty = 0;
  for (const crime of state.progression.crimes) {
    if (!crime.reported || crime.paid) continue;
    galacticBounty += crime.bounty;
    if (crime.faction !== authority.faction) continue;
    fine += crime.fine;
    bounty += crime.bounty;
    if (crime.systemId === system.id) local += crimeAlert(crime, state.time);
  }
  return {
    ...authority,
    level: Math.min(5, local),
    fine,
    bounty,
    galacticBounty,
  };
}

export function reportCrime(
  state: Save,
  system: StarSystem,
  target: string,
  type: Crime["type"],
  witnessed: boolean,
  authorityTarget: boolean,
) {
  const { faction, security } = jurisdiction(system);
  const severity = (type === "destruction" ? 2 : 1) + (authorityTarget ? 1 : 0);
  const crimes = state.progression.crimes;
  const id = `${system.id}:crime:${crimes.length + 1}`;
  const detected =
    type === "destruction" ||
    witnessed ||
    authorityTarget ||
    hash(id) % 100 < 25 * security;
  crimes.push({
    id,
    type,
    target,
    systemId: system.id,
    systemName: system.name,
    faction,
    shipId: state.activeShip.id,
    time: state.time,
    severity,
    fine: severity * 220,
    bounty: severity * 350,
    detected,
    reported: detected,
    paid: false,
  });
  return detected;
}

export function payFines(state: Save) {
  const system = systemAt(state.seed, state.systemX, state.systemY);
  if (state.mode !== "docked" || !system.station)
    return "Acople para pagar multas.";
  const status = wantedStatus(state, system);
  if (!status.fine) return "Nenhuma multa pendente nesta jurisdição.";
  if (state.credits < status.fine)
    return "Créditos insuficientes para regularizar o registro.";
  settleJurisdiction(state, status);
}

function settleJurisdiction(
  state: Save,
  status: ReturnType<typeof wantedStatus>,
) {
  state.credits -= status.fine;
  for (const crime of state.progression.crimes)
    if (crime.reported && crime.faction === status.faction) crime.paid = true;
}

export function surrenderToPolice(state: Save, system: StarSystem) {
  const status = wantedStatus(state, system);
  const confiscated = state.inventory.sealedCargo ?? 0;
  delete state.inventory.sealedCargo;
  if (state.credits < status.fine)
    return `Rendição aceita. Carga lacrada recolhida: ${confiscated}. A multa de ${status.fine.toLocaleString("pt-BR")} CR continua pendente por falta de saldo.`;
  settleJurisdiction(state, status);
  return `Rendição aceita. Multa paga: ${status.fine.toLocaleString("pt-BR")} CR. Carga lacrada recolhida: ${confiscated}.`;
}
