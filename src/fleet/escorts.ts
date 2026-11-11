import { hash } from "../game/procedural/random";
import type { Save, ShipModelId, StarSystem } from "../game/types";

export const ESCORT_LIMIT = 2;
export const SERVICE_HOUR = 3600;
export const REPAIR_DURATION = 120;
const OFFER_INTERVAL = 1800;

export const escortTiers = {
  light: {
    label: "Escolta leve",
    hire: 12_000,
    hourly: 1000,
    hull: 70,
    damage: 5,
    cooldown: 1.25,
    models: ["sparrow", "kestrel"],
  },
  interceptor: {
    label: "Interceptador rápido",
    hire: 22_000,
    hourly: 2000,
    hull: 95,
    damage: 7,
    cooldown: 0.95,
    models: ["viper", "raptor"],
  },
  heavy: {
    label: "Escolta pesada",
    hire: 35_000,
    hourly: 3500,
    hull: 150,
    damage: 11,
    cooldown: 1.15,
    models: ["bastion", "warden"],
  },
} satisfies Record<
  string,
  {
    label: string;
    hire: number;
    hourly: number;
    hull: number;
    damage: number;
    cooldown: number;
    models: ShipModelId[];
  }
>;
type EscortTier = keyof typeof escortTiers;

interface EscortOffer {
  id: string;
  name: string;
  tier: EscortTier;
  model: ShipModelId;
}

export interface EscortContract extends EscortOffer {
  hull: number;
  remaining: number;
  repairUntil: number;
}

const names = [
  "Astra",
  "Ciro",
  "Dara",
  "Ivo",
  "Kael",
  "Lyra",
  "Nox",
  "Rhea",
  "Zara",
];
const callSigns = [
  "Vetor",
  "Orion",
  "Eclipse",
  "Pulso",
  "Íon",
  "Halo",
  "Fóton",
];

export function escortOffers(state: Save, system: StarSystem): EscortOffer[] {
  const period = Math.floor((state.activePlayTime ?? 0) / OFFER_INTERVAL);
  return (Object.keys(escortTiers) as EscortTier[]).map((tier, index) => {
    const id = `${system.id}:escort:${period}:${tier}`;
    const seed = hash(`${system.id}:${tier}`);
    const models = escortTiers[tier].models;
    return {
      id,
      tier,
      name: `${names[(seed + period + index) % names.length]} «${callSigns[(seed + period) % callSigns.length]}»`,
      model: models[(seed + period) % models.length]!,
    };
  });
}

export function hireEscort(state: Save, system: StarSystem, id: string) {
  if (state.mode !== "docked" || system.station?.kind !== "clandestine")
    return "O recrutamento ocorre em estações clandestinas.";
  const offer = escortOffers(state, system).find(
    (candidate) => candidate.id === id,
  );
  if (!offer) return "Esta oferta expirou.";
  const contracts = state.escorts ?? [];
  if (contracts.some((pilot) => pilot.id === id))
    return "Piloto já contratado.";
  if (contracts.length >= ESCORT_LIMIT)
    return "Sua escolta já tem dois pilotos.";
  const tier = escortTiers[offer.tier];
  if (state.credits < tier.hire) return "Créditos insuficientes.";
  state.credits -= tier.hire;
  state.escorts = [
    ...contracts,
    { ...offer, hull: tier.hull, remaining: SERVICE_HOUR, repairUntil: 0 },
  ];
}

export function renewEscort(state: Save, pilot: EscortContract) {
  if (pilot.remaining > 0) return "O contrato ainda está ativo.";
  const rate = escortTiers[pilot.tier].hourly;
  if (state.credits < rate) return "Créditos insuficientes para renovar.";
  state.credits -= rate;
  pilot.remaining = SERVICE_HOUR;
}

export function tickEscorts(state: Save, dt: number) {
  const notices: string[] = [];
  const now = state.activePlayTime ?? 0;
  for (const pilot of state.escorts ?? []) {
    if (pilot.repairUntil > 0) {
      if (pilot.repairUntil > now) continue;
      pilot.repairUntil = 0;
      pilot.hull = escortTiers[pilot.tier].hull;
      notices.push(`${pilot.name} concluiu o reparo e voltou à escolta.`);
    }
    if (pilot.remaining <= 0) continue;
    pilot.remaining = Math.max(0, pilot.remaining - dt);
    if (pilot.remaining > 0) continue;
    if (renewEscort(state, pilot))
      notices.push(
        `${pilot.name} saiu da formação por falta de saldo. Renove pelo rádio ou com o recrutador.`,
      );
    else
      notices.push(
        `${pilot.name}: contrato renovado por ${escortTiers[pilot.tier].hourly.toLocaleString("pt-BR")} CR.`,
      );
  }
  return notices;
}

export function escortTime(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}
