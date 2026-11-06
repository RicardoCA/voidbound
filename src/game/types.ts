export type Mode = "space" | "orbit" | "surface" | "interior";
export type Item =
  | "iron"
  | "copper"
  | "silicon"
  | "carbon"
  | "titanium"
  | "crystal"
  | "ice"
  | "fiber"
  | "wood"
  | "rawFuel"
  | "plate"
  | "circuit"
  | "cell"
  | "repair"
  | "oxygen"
  | "fuel"
  | "engine"
  | "laser"
  | "tank"
  | "shield"
  | "cargo"
  | "jump"
  | "drill";
export type Inventory = Partial<Record<Item, number>>;
export interface Planet {
  id: string;
  seed: number;
  name: string;
  kind: number;
  gravity: number;
  temperature: number;
  breathable: boolean;
  color: number;
  radius: number;
}
export interface StarSystem {
  id: string;
  x: number;
  y: number;
  name: string;
  star: string;
  planets: Planet[];
}
export interface Save {
  version: 1;
  seed: string;
  mode: Mode;
  systemX: number;
  systemY: number;
  planetIndex: number;
  ship: {
    x: number;
    y: number;
    angle: number;
    vx: number;
    vy: number;
    hull: number;
    fuel: number;
    energy: number;
    oxygen: number;
  };
  player: {
    x: number;
    y: number;
    health: number;
    oxygen: number;
    energy: number;
  };
  inventory: Inventory;
  upgrades: Item[];
  changes: Record<string, Record<string, number>>;
  depleted: string[];
  visited: string[];
  mission: number;
  flags: string[];
  time: number;
  landingX: number;
}
export const items: Record<
  Item,
  { name: string; color: string; icon: string; rarity: string; stack: number }
> = {
  iron: {
    name: "Ferro",
    color: "#a5bbcd",
    icon: "◆",
    rarity: "Comum",
    stack: 99,
  },
  copper: {
    name: "Cobre",
    color: "#e99860",
    icon: "◆",
    rarity: "Comum",
    stack: 99,
  },
  silicon: {
    name: "Silício",
    color: "#b4ace4",
    icon: "◇",
    rarity: "Comum",
    stack: 99,
  },
  carbon: {
    name: "Carbono",
    color: "#748d9b",
    icon: "⬡",
    rarity: "Comum",
    stack: 99,
  },
  titanium: {
    name: "Titânio",
    color: "#78d4d9",
    icon: "◆",
    rarity: "Raro",
    stack: 99,
  },
  crystal: {
    name: "Cristal energético",
    color: "#b599ff",
    icon: "✦",
    rarity: "Raro",
    stack: 99,
  },
  ice: {
    name: "Gelo",
    color: "#99e4fa",
    icon: "◇",
    rarity: "Comum",
    stack: 99,
  },
  fiber: {
    name: "Fibra orgânica",
    color: "#a4cc7b",
    icon: "⌁",
    rarity: "Comum",
    stack: 99,
  },
  wood: {
    name: "Madeira alienígena",
    color: "#b6aa72",
    icon: "▥",
    rarity: "Comum",
    stack: 99,
  },
  rawFuel: {
    name: "Combustível bruto",
    color: "#e4c875",
    icon: "⬢",
    rarity: "Comum",
    stack: 99,
  },
  plate: {
    name: "Placa metálica",
    color: "#a5bbcd",
    icon: "▰",
    rarity: "Fabricado",
    stack: 99,
  },
  circuit: {
    name: "Circuito básico",
    color: "#81c9a8",
    icon: "▦",
    rarity: "Fabricado",
    stack: 99,
  },
  cell: {
    name: "Célula energética",
    color: "#c0a6fc",
    icon: "▣",
    rarity: "Fabricado",
    stack: 99,
  },
  repair: {
    name: "Kit de reparo",
    color: "#faab77",
    icon: "✚",
    rarity: "Fabricado",
    stack: 99,
  },
  oxygen: {
    name: "Tanque de oxigênio",
    color: "#9de4e9",
    icon: "▥",
    rarity: "Fabricado",
    stack: 99,
  },
  fuel: {
    name: "Combustível refinado",
    color: "#ecc77b",
    icon: "▣",
    rarity: "Fabricado",
    stack: 99,
  },
  engine: {
    name: "Motor MK-II",
    color: "#f8c37c",
    icon: "➤",
    rarity: "Melhoria",
    stack: 1,
  },
  laser: {
    name: "Laser avançado",
    color: "#e7a2a5",
    icon: "⌁",
    rarity: "Melhoria",
    stack: 1,
  },
  tank: {
    name: "Tanque adicional",
    color: "#ecc77b",
    icon: "▥",
    rarity: "Melhoria",
    stack: 1,
  },
  shield: {
    name: "Escudo básico",
    color: "#9edcfa",
    icon: "⬡",
    rarity: "Melhoria",
    stack: 1,
  },
  cargo: {
    name: "Compartimento de carga",
    color: "#b7c9da",
    icon: "▣",
    rarity: "Melhoria",
    stack: 1,
  },
  jump: {
    name: "Propulsor de salto",
    color: "#c3a4f8",
    icon: "✧",
    rarity: "Melhoria",
    stack: 1,
  },
  drill: {
    name: "Broca aprimorada",
    color: "#a1d5d2",
    icon: "▼",
    rarity: "Melhoria",
    stack: 1,
  },
};
export const resourceIds: Item[] = [
  "iron",
  "copper",
  "silicon",
  "carbon",
  "titanium",
  "crystal",
  "ice",
  "fiber",
  "wood",
  "rawFuel",
];
export const biomes = [
  {
    name: "Rochoso",
    color: 0x9b817c,
    sky: 0x192236,
    ground: 0x605159,
    resources: "Ferro · Cobre · Silício",
    hazard: "Atmosfera rarefeita",
  },
  {
    name: "Desértico",
    color: 0xd6b47c,
    sky: 0x362936,
    ground: 0x9b7157,
    resources: "Silício · Cristais · Carbono",
    hazard: "Calor intenso",
  },
  {
    name: "Gelado",
    color: 0x99c7d8,
    sky: 0x182f4b,
    ground: 0x618b9e,
    resources: "Gelo · Cristais · Ferro",
    hazard: "Frio extremo",
  },
  {
    name: "Florestal",
    color: 0x7dab9b,
    sky: 0x172d35,
    ground: 0x526e65,
    resources: "Fibras · Madeira · Cobre",
    hazard: "Gravidade variável",
  },
  {
    name: "Vulcânico",
    color: 0xdb8064,
    sky: 0x351c2b,
    ground: 0x784954,
    resources: "Titânio · Carbono · Combustível",
    hazard: "Temperaturas extremas",
  },
  {
    name: "Oceânico",
    color: 0x6db8c3,
    sky: 0x152c48,
    ground: 0x527b88,
    resources: "Gelo · Silício · Fibras",
    hazard: "Cavernas costeiras",
  },
];
