import type { Inventory } from "../game/types";
export const facilityDefinitions = {
  tradingPost: {
    name: "Entreposto comercial", file: "entreposto-comercial", color: "#e1b665",
    watts: 2, seconds: 180,
    description: "Deposite excedentes e autorize os itens à venda. Cargueiros pousam a cada 3 minutos energizados; aproxime-se da nave para conversar e comprá-la.",
    cost: { stone: 40, plate: 30, circuit: 10, titanium: 15 },
  },
  communicationsPost: {
    name: "Posto de atendimento e comunicações", file: "posto-comunicacoes", color: "#81cfd9",
    watts: 1, seconds: 300,
    description: "Recebe avisos, pedidos de ajuda e ofertas comerciais. Entregas ao conselho local geram influência em planetas habitados.",
    cost: { stone: 25, plate: 16, circuit: 8, silicon: 20, copper: 12 },
  },
  planetRefinery: {
    name: "Refinaria planetária",
    file: "refinaria-planetaria",
    color: "#e8a45c",
    watts: 3,
    seconds: 12,
    description:
      "Processa minérios em fila. Deposite ingredientes e retire os produtos do reservatório.",
    cost: { stone: 30, plate: 18, circuit: 6, titanium: 10 },
  },
  observatory: {
    name: "Observatório planetário",
    file: "observatorio-planetario",
    color: "#89b9fa",
    watts: 2,
    seconds: 30,
    description:
      "Varre o sistema e encontra pistas de anomalias e ruínas ainda não catalogadas. Exige céu livre.",
    cost: { plate: 16, silicon: 20, circuit: 8, crystal: 6 },
  },
  geoProbe: {
    name: "Sonda geológica",
    file: "sonda-geologica",
    color: "#dfc578",
    watts: 2,
    seconds: 10,
    description:
      "Lê depósitos reais próximos e informa direção, distância e profundidade.",
    cost: { plate: 8, circuit: 4, titanium: 5, crystal: 3 },
  },
  climateCollector: {
    name: "Coletor climático",
    file: "coletor-climatico",
    color: "#8bdaca",
    watts: 1,
    seconds: 10,
    description:
      "Exposto ao céu, coleta água na chuva, gelo na neve e resíduos minerais na chuva ácida.",
    cost: { plate: 10, circuit: 3, silicon: 8, copper: 6 },
  },
  weatherStation: {
    name: "Estação meteorológica",
    file: "estacao-meteorologica",
    color: "#b2e1e6",
    watts: 1,
    seconds: 1,
    description:
      "Prevê a próxima precipitação e avisa sobre chuva ácida e nevascas. Exige céu livre.",
    cost: { plate: 8, circuit: 5, silicon: 10, copper: 8 },
  },
  sampleLab: {
    name: "Laboratório de amostras",
    file: "laboratorio-amostras",
    color: "#c4a5f2",
    watts: 3,
    seconds: 20,
    description:
      "Analisa minerais, plantas e fragmentos de ruínas; gera dados científicos negociáveis. Primeiras análises valem mais.",
    cost: { plate: 20, circuit: 10, silicon: 20, crystal: 8, titanium: 8 },
  },
} as const;
export type FacilityKind = keyof typeof facilityDefinitions;
export function isFacility(id: string): id is FacilityKind {
  return Object.hasOwn(facilityDefinitions, id);
}
export interface FacilityJob {
  recipe: string;
  remaining: number;
  progress: number;
}
export interface FacilityClue {
  name: string;
  x?: number;
  y?: number;
  z?: number;
  planetId?: string;
}
export interface FacilityState {
  input: Inventory;
  output: Inventory;
  queue: FacilityJob[];
  blocked?: boolean;
  energySeconds?: number;
  collection?: number;
  lastCycle?: number;
  clues?: FacilityClue[];
  message?: string;
  trade?: import("./planetCommerce").TradingState;
  communications?: import("./planetCommerce").CommunicationsState;
}
export function emptyFacility(): FacilityState {
  return { input: {}, output: {}, queue: [] };
}
