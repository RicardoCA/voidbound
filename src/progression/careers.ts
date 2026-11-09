import type { Crime } from "../combat/law";
import type { Piracy } from "../combat/traffic";
import type { ContractRecord } from "./contracts";
import type { Discovery } from "./exploration";
export const careerIds = [
  "explorer",
  "miner",
  "pirate",
  "bountyHunter",
] as const;
export type CareerId = (typeof careerIds)[number];
export const CAREER_LEVEL_CAP = 30;

export const careerDefinitions = {
  explorer: {
    name: "Explorador",
    ranks: [
      "Curioso Espacial",
      "Cartógrafo",
      "Desbravador",
      "Pioneiro",
      "Lenda Galáctica",
    ],
  },
  miner: {
    name: "Minerador",
    ranks: [
      "Garimpeiro",
      "Extrator",
      "Prospector",
      "Magnata Mineral",
      "Mestre da Extração",
    ],
  },
  pirate: {
    name: "Pirata",
    ranks: [
      "Saqueador",
      "Corsário",
      "Predador Espacial",
      "Terror dos Sistemas",
      "Lenda Fora da Lei",
    ],
  },
  bountyHunter: {
    name: "Caçador de recompensas",
    ranks: [
      "Rastreador",
      "Caçador Licenciado",
      "Interceptador",
      "Marechal de Fronteira",
      "Lenda das Recompensas",
    ],
  },
} satisfies Record<CareerId, { name: string; ranks: string[] }>;

interface CareerActivity {
  label: string;
  time: number;
  xp: number;
}

interface CareerRecord {
  xp: number;
  history: CareerActivity[];
}

export interface Progression {
  careers: Record<CareerId, CareerRecord>;
  cataloguedPlanets: Record<string, true>;
  discoveries: Record<string, Discovery>;
  rareDeposits: Record<string, true>;
  contracts: Record<string, ContractRecord>;
  piracy: Piracy;
  crimes: Crime[];
  extracted: number;
  refined: number;
}

export function newProgression(): Progression {
  return {
    careers: {
      explorer: { xp: 0, history: [] },
      miner: { xp: 0, history: [] },
      pirate: { xp: 0, history: [] },
      bountyHunter: { xp: 0, history: [] },
    },
    cataloguedPlanets: {},
    discoveries: {},
    rareDeposits: {},
    contracts: {},
    piracy: { wrecks: {}, recovered: 0, sold: 0 },
    crimes: [],
    extracted: 0,
    refined: 0,
  };
}

export function xpForNextLevel(level: number) {
  return Math.round(100 * level ** 1.5);
}

const thresholds = [0];
for (let level = 1; level < 100; level++) {
  thresholds.push(thresholds[level - 1]! + xpForNextLevel(level));
}

export function careerLevel(id: CareerId, xp: number, cap = CAREER_LEVEL_CAP) {
  let level = 1;
  while (level < cap && xp >= thresholds[level]!) level++;
  const maximum = level === cap;
  return {
    level,
    rank: careerDefinitions[id].ranks[
      Math.min(4, Math.floor((level - 1) / 6))
    ]!,
    progress: maximum ? 0 : xp - thresholds[level - 1]!,
    target: maximum ? 0 : xpForNextLevel(level),
  };
}

export function awardCareerXP(
  data: Progression,
  id: CareerId,
  amount: number,
  label: string,
  time: number,
) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  const record = data.careers[id];
  const xp = Math.min(amount, thresholds[CAREER_LEVEL_CAP - 1]! - record.xp);
  if (xp <= 0) return;
  record.xp += xp;
  record.history.unshift({ label, time, xp });
  record.history.length = Math.min(record.history.length, 40);
}

export function recordMining(
  data: Progression,
  quantity: number,
  time: number,
) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
  const before = Math.floor(data.extracted / 10);
  data.extracted += quantity;
  awardCareerXP(
    data,
    "miner",
    (Math.floor(data.extracted / 10) - before) * 20,
    "Extração de minério",
    time,
  );
}

export function miningEfficiency(data: Progression) {
  return (
    (careerLevel("miner", data.careers.miner.xp).level - 1) *
    (0.2 / (CAREER_LEVEL_CAP - 1))
  );
}
