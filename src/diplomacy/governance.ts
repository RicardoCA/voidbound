import { hash } from "../game/procedural/random";
import type { Inventory, Planet, Save } from "../game/types";
import { consume } from "../inventory/inventory";

const societies = [
  {
    name: "Povo de Íria",
    representative: "Emissária Nara",
    color: 0x64c6bd,
    dialogue:
      "Nossas cidades cresceram em torno das nascentes. O conselho valoriza quem garante água e abrigo às famílias.",
  },
  {
    name: "Comunidade Varo",
    representative: "Delegado Tarek",
    color: 0xe0a269,
    dialogue:
      "Construímos nossos abrigos nas falésias. Precisamos de materiais para expandir a colônia com segurança.",
  },
  {
    name: "Conselho de Lume",
    representative: "Conselheira Selene",
    color: 0xb29aeb,
    dialogue:
      "Nosso povo mantém estações de comunicação entre os assentamentos. Podemos compartilhar nossas rotas quando houver confiança.",
  },
] as const;

export function civilizationOf(planet: Planet) {
  const seed = hash(planet.id + ":civilization");
  const secondHomePlanet = planet.id.endsWith(":0:0:p1");
  const firstHomePlanet = planet.id.endsWith(":0:0:p0");
  if (!secondHomePlanet && (firstHomePlanet || seed % 5 !== 0)) return;
  return societies[Math.floor(seed / 5) % societies.length];
}

export const civicAid = {
  supplies: {
    title: "Entregar materiais de construção",
    cost: { iron: 12, copper: 6 },
  },
  communications: {
    title: "Apoiar a rede de comunicações",
    cost: { circuit: 3, silicon: 6 },
  },
  energy: { title: "Abastecer o assentamento", cost: { cell: 2, crystal: 6 } },
} satisfies Record<string, { title: string; cost: Inventory }>;
export const civicProjects = {
  clinic: {
    title: "Financiar posto médico",
    cost: 2200,
    benefit: "Recupera a saúde ao conversar com o representante.",
  },
  logistics: {
    title: "Construir entreposto orbital",
    cost: 3500,
    benefit: "Permite abastecer a nave pousada pelo conselho.",
  },
} as const;

type Aid = keyof typeof civicAid;
type Project = keyof typeof civicProjects;
export type CivicAction = Aid | Project | "govern" | "heal" | "refuel";
export interface PlanetGovernment {
  aid: Aid[];
  governed: boolean;
  projects: Project[];
}

export function planetaryInfluence(record?: PlanetGovernment) {
  return record
    ? record.aid.length * 20 +
        (record.governed ? 20 : 0) +
        record.projects.length * 10
    : 0;
}

export function applyCivicAction(
  state: Save,
  planet: Planet,
  action: CivicAction,
  maxFuel: number,
) {
  if (state.mode !== "surface" || !civilizationOf(planet))
    return "Converse com o conselho na superfície.";
  const record = state.governments?.[planet.id] ?? {
    aid: [],
    governed: false,
    projects: [],
  };
  if (action === "govern") {
    if (record.governed || record.aid.length < Object.keys(civicAid).length)
      return "O conselho exige apoio em todos os projetos de ajuda antes da votação.";
    record.governed = true;
  } else if (action === "heal") {
    if (!record.projects.includes("clinic") || state.player.health >= 100)
      return "Atendimento indisponível.";
    state.player.health = 100;
  } else if (action === "refuel") {
    if (!record.projects.includes("logistics") || state.ship.fuel >= maxFuel)
      return "Abastecimento indisponível.";
    const amount = Math.min(20, Math.ceil(maxFuel - state.ship.fuel));
    const cost = amount * 8;
    if (state.credits < cost) return "Créditos insuficientes.";
    state.credits -= cost;
    state.ship.fuel = Math.min(maxFuel, state.ship.fuel + amount);
  } else if (action in civicAid) {
    const aid = action as Aid;
    if (record.aid.includes(aid)) return "O conselho já recebeu essa entrega.";
    if (!consume(state.backpack, civicAid[aid].cost))
      return "Materiais insuficientes na mochila.";
    record.aid.push(aid);
  } else {
    const project = action as Project;
    if (!record.governed || record.projects.includes(project))
      return "Projeto indisponível.";
    if (state.credits < civicProjects[project].cost)
      return "Créditos insuficientes.";
    state.credits -= civicProjects[project].cost;
    record.projects.push(project);
  }
  (state.governments ??= {})[planet.id] = record;
}
