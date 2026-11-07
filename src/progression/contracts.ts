import { hasBlackMarket } from "../combat/traffic";
import { items, type Save, type StarSystem } from "../game/types";
import { consume } from "../inventory/inventory";
import { hash } from "../game/procedural/random";
import { systemAt } from "../universe/generator";
import { awardCareerXP, careerLevel } from "./careers";
import { anomalyAt } from "./exploration";

export type ContractStatus =
  "AVAILABLE" | "ACTIVE" | "COMPLETED" | "FAILED" | "CLAIMED";
type ContractGoal =
  | { kind: "discovery"; id: string; name: string }
  | {
      kind: "delivery";
      item: "iron" | "copper" | "titanium" | "crystal" | "sealedCargo";
      quantity: number;
    };
export interface Contract {
  id: string;
  stationId: string;
  career: "explorer" | "miner" | "pirate";
  title: string;
  sector: { x: number; y: number };
  goal: ContractGoal;
  credits: number;
  xp: number;
  difficulty: number;
  deadline?: number;
}

export interface ContractRecord extends Contract {
  status: "ACTIVE" | "FAILED" | "CLAIMED";
  acceptedAt: number;
}

const industry = [
  { level: 1, quantity: 30, credits: 1500, xp: 100 },
  { level: 7, quantity: 40, credits: 7000, xp: 500 },
  { level: 13, quantity: 100, credits: 25000, xp: 1000 },
  { level: 19, quantity: 160, credits: 40000, xp: 1500 },
] as const;

export function contractOffers(state: Save, system: StarSystem): Contract[] {
  if (!system.station) return [];
  const stationId = system.station.id;
  const cycle = Math.floor(state.time / 600);
  const seed = hash(`${system.id}:contracts:${cycle}`);
  const sector = { x: system.x, y: system.y };
  const accepted = state.progression.contracts;
  const minerLevel = careerLevel(
    "miner",
    state.progression.careers.miner.xp,
  ).level;
  const explorerLevel = careerLevel(
    "explorer",
    state.progression.careers.explorer.xp,
  ).level;
  const offers: Contract[] = [];
  for (const [index, tier] of industry.entries()) {
    if (minerLevel < tier.level) continue;
    // Iron and copper are common in terrain; every system has titanium/crystal asteroids.
    const item =
      index === 0
        ? seed % 2 === 0
          ? "iron"
          : "copper"
        : seed % 2 === 0
          ? "titanium"
          : "crystal";
    offers.push({
      id: `${stationId}:industry:${cycle}:${index}`,
      stationId,
      career: "miner",
      title: `Fornecimento de ${items[item].name}`,
      sector,
      goal: { kind: "delivery", item, quantity: tier.quantity },
      credits: tier.credits,
      xp: tier.xp,
      difficulty: index + 1,
    });
  }
  const target = system.planets.find(
    (planet) => !state.progression.cataloguedPlanets[planet.id],
  );
  if (target)
    offers.push({
      id: `${stationId}:survey:${target.id}`,
      stationId,
      career: "explorer",
      title: `Levantamento de ${target.name}`,
      sector,
      goal: { kind: "discovery", id: `planet:${target.id}`, name: target.name },
      credits: 1000 + (seed % 701),
      xp: 350,
      difficulty: 1,
    });
  const anomaly = anomalyAt(system);
  if (
    anomaly &&
    explorerLevel >= Math.max(7, anomaly.level) &&
    !state.progression.discoveries[anomaly.id]
  ) {
    offers.push({
      id: `${stationId}:signal:${anomaly.id}`,
      stationId,
      career: "explorer",
      title: "Investigação de sinal anômalo",
      sector,
      goal: { kind: "discovery", id: anomaly.id, name: anomaly.name },
      credits: Math.floor(anomaly.credits * 0.5),
      xp: 350,
      difficulty: 3,
    });
  }
  if (hasBlackMarket(system)) {
    const level = careerLevel(
      "pirate",
      state.progression.careers.pirate.xp,
    ).level;
    const advanced = level >= 7;
    offers.push({
      id: `${stationId}:smuggling:${cycle}:${advanced ? 2 : 1}`,
      stationId,
      career: "pirate",
      title: advanced ? "Carregamento clandestino" : "Remessa sem manifesto",
      sector,
      goal: {
        kind: "delivery",
        item: "sealedCargo",
        quantity: advanced ? 10 : 4,
      },
      credits: advanced ? 15000 : 5000,
      xp: advanced ? 500 : 250,
      difficulty: advanced ? 3 : 1,
    });
  }
  return offers.filter((offer) => !Object.hasOwn(accepted, offer.id));
}

export function contractStatus(
  state: Save,
  contract: Contract,
): ContractStatus {
  const record = state.progression.contracts[contract.id];
  if (!record) return "AVAILABLE";
  if (record.status !== "ACTIVE") return record.status;
  if (record.deadline !== undefined && state.time > record.deadline)
    return "FAILED";
  const goal = record.goal;
  const done =
    goal.kind === "discovery"
      ? Boolean(state.progression.discoveries[goal.id])
      : (state.inventory[goal.item] ?? 0) >= goal.quantity;
  return done ? "COMPLETED" : "ACTIVE";
}

function dockedAt(state: Save, stationId: string) {
  return (
    state.mode === "docked" &&
    systemAt(state.seed, state.systemX, state.systemY).station?.id === stationId
  );
}

export function acceptContract(state: Save, stationId: string, id: string) {
  if (!dockedAt(state, stationId)) return "Acople à estação emissora.";
  const active = Object.values(state.progression.contracts).filter((contract) =>
    ["ACTIVE", "COMPLETED"].includes(contractStatus(state, contract)),
  );
  if (active.length >= 3)
    return "Conclua ou abandone um dos três contratos ativos.";
  const system = systemAt(state.seed, state.systemX, state.systemY);
  const offer = contractOffers(state, system).find(
    (contract) => contract.id === id,
  );
  if (!offer) return "Contrato indisponível.";
  state.progression.contracts[id] = {
    ...offer,
    status: "ACTIVE",
    acceptedAt: state.time,
    ...(offer.difficulty >= 3 ? { deadline: state.time + 900 } : {}),
  };
}

export function abandonContract(state: Save, stationId: string, id: string) {
  const contract = state.progression.contracts[id];
  if (
    !dockedAt(state, stationId) ||
    !contract ||
    contract.stationId !== stationId ||
    contract.status !== "ACTIVE"
  )
    return "Contrato indisponível para abandono.";
  contract.status = "FAILED";
}

export function claimContract(state: Save, stationId: string, id: string) {
  const contract = state.progression.contracts[id];
  if (
    !dockedAt(state, stationId) ||
    !contract ||
    contract.stationId !== stationId ||
    contractStatus(state, contract) !== "COMPLETED"
  )
    return "Contrato indisponível ou objetivos incompletos.";
  const balance = state.credits + contract.credits;
  if (!Number.isSafeInteger(balance)) return "Limite de créditos atingido.";
  const goal = contract.goal;
  if (
    goal.kind === "delivery" &&
    !consume(state.inventory, { [goal.item]: goal.quantity })
  )
    return "A carga ativa não contém o lote solicitado.";
  state.credits = balance;
  contract.status = "CLAIMED";
  awardCareerXP(
    state.progression,
    contract.career,
    contract.xp,
    contract.title,
    state.time,
  );
}
