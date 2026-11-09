import { hasBlackMarket, type SpaceNpc } from "../combat/traffic";
import { items, type Save, type StarSystem } from "../game/types";
import { consume } from "../inventory/inventory";
import { hash } from "../game/procedural/random";
import { systemAt } from "../universe/generator";
import { awardCareerXP, careerLevel, type CareerId } from "./careers";
import { anomalyAt } from "./exploration";

export type ContractStatus =
  "AVAILABLE" | "ACTIVE" | "COMPLETED" | "FAILED" | "CLAIMED";
type ContractGoal =
  | { kind: "discovery"; id: string; name: string }
  | { kind: "bounty"; targetId: string; name: string }
  | {
      kind: "delivery";
      item: "iron" | "copper" | "titanium" | "crystal" | "sealedCargo";
      quantity: number;
    };
export interface Contract {
  id: string;
  stationId: string;
  career: CareerId;
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
  const sector = { x: system.x, y: system.y };
  const accepted = state.progression.contracts;
  if (hasBlackMarket(system)) {
    const level = careerLevel(
      "pirate",
      state.progression.careers.pirate.xp,
    ).level;
    const advanced = level >= 7;
    const offer: Contract = {
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
    };
    return Object.hasOwn(accepted, offer.id) ? [] : [offer];
  }
  const seed = hash(`${system.id}:contracts:${cycle}`);
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
  const level = careerLevel(
    "bountyHunter",
    state.progression.careers.bountyHunter.xp,
  ).level;
  const advanced = level >= 7;
  const bountyId = `${stationId}:bounty:${cycle}`;
  const aliases = [
    "Lobo Rubro",
    "Víbora Cega",
    "Fantasma de Ferro",
    "Corvo do Vazio",
    "Dente de Cinzas",
  ];
  const fugitive = aliases[seed % aliases.length]!;
  offers.push({
    id: bountyId,
    stationId,
    career: "bountyHunter",
    title: `Recompensa por ${fugitive}`,
    sector,
    goal: { kind: "bounty", targetId: `${bountyId}:target`, name: fugitive },
    credits: advanced ? 24_000 : 8_500,
    xp: advanced ? 650 : 300,
    difficulty: advanced ? 2 : 1,
  });
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
      : goal.kind === "bounty"
        ? Object.hasOwn(state.progression.piracy.wrecks, goal.targetId)
        : (state.inventory[goal.item] ?? 0) >= goal.quantity;
  return done ? "COMPLETED" : "ACTIVE";
}

export function bountyTargets(state: Save, system: StarSystem): SpaceNpc[] {
  const station = system.station;
  if (!station) return [];
  return Object.values(state.progression.contracts).flatMap((contract) => {
    const { goal } = contract;
    if (
      goal.kind !== "bounty" ||
      contract.stationId !== station.id ||
      contractStatus(state, contract) !== "ACTIVE"
    )
      return [];
    const seed = hash(goal.targetId);
    const home = {
      x: station.x - 275 - (seed % 150),
      y: station.y + 135 + (seed % 180),
    };
    const advanced = contract.difficulty > 1;
    const hull = advanced ? 155 : 80;
    return [
      {
        id: goal.targetId,
        role: "pirate",
        bountyTarget: true,
        name: goal.name,
        model: advanced ? "bastion" : "viper",
        faction: "Independentes",
        home,
        ...home,
        hull,
        maxHull: hull,
        shield: advanced ? 55 : 20,
        wantedLevel: advanced ? 5 : 3,
        angle: 0,
        vx: 0,
        vy: 0,
        cargo: { sealedCargo: advanced ? 5 : 2 },
        engaged: false,
        fireAt: 0,
      },
    ];
  });
}

function dockedAt(state: Save, stationId: string, career?: Contract["career"]) {
  const system = systemAt(state.seed, state.systemX, state.systemY);
  return (
    state.mode === "docked" &&
    system.station?.id === stationId &&
    (career === undefined || (career === "pirate") === hasBlackMarket(system))
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
    !contract ||
    !dockedAt(state, stationId, contract.career) ||
    contract.stationId !== stationId ||
    contract.status !== "ACTIVE"
  )
    return "Contrato indisponível para abandono.";
  contract.status = "FAILED";
}

export function claimContract(state: Save, stationId: string, id: string) {
  const contract = state.progression.contracts[id];
  if (
    !contract ||
    !dockedAt(state, stationId, contract.career) ||
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
