import type { Wardrobe } from "../wardrobe/clothing";
import type { Progression } from "../progression/careers";
export type Mode = "space" | "orbit" | "surface" | "interior" | "docked";
export type Item =
  | "stick"
  | "iron"
  | "copper"
  | "silicon"
  | "carbon"
  | "titanium"
  | "crystal"
  | "ice"
  | "fiber"
  | "wood"
  | "basaltBerry"
  | "amberFig"
  | "frostPlum"
  | "jadePear"
  | "emberFruit"
  | "tideMelon"
  | "sealedCargo"
  | "rawMeat"
  | "cookedMeat"
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
  | "drill"
  | "woodBlock"
  | "woodWall"
  | "woodStairs"
  | "stickLadder"
  | "woodHatch"
  | "cabinet"
  | "cabinetDouble"
  | "cabinetTriple"
  | "woodDoor"
  | "solarPanel"
  | "campfire"
  | "battery"
  | "oxygenGenerator";
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
export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
}
export interface StarSystem {
  id: string;
  x: number;
  y: number;
  name: string;
  star: string;
  planets: Planet[];
  station?: Station;
}
export type BuildItem =
  | "woodBlock"
  | "woodWall"
  | "woodStairs"
  | "stickLadder"
  | "woodHatch"
  | "cabinet"
  | "cabinetDouble"
  | "cabinetTriple"
  | "woodDoor"
  | "solarPanel"
  | "campfire"
  | "battery"
  | "oxygenGenerator";
export interface PlacedPiece {
  kind: Exclude<BuildItem, "woodWall">;
  facing: 1 | -1;
  open?: boolean;
  energy?: number;
  oxygen?: number;
}
export interface Settlement {
  pieces: Record<string, PlacedPiece>;
  walls: Record<string, true>;
  cabinets: Record<string, Inventory>;
  cutTrees: string[];
  foraged?: Record<string, number>;
  hunted?: Record<string, number>;
  utilityTime?: number;
}
export type ShipModelId = keyof typeof import("../fleet/models").shipModels;
export interface ShipState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  hull: number;
  fuel: number;
  energy: number;
  oxygen: number;
}
export interface ShipIdentity {
  rescue?: true;
  id: string;
  model: ShipModelId;
}
export interface PilotTrip {
  destination: { x: number; y: number };
  item: import("../economy/market").MarketItem;
  quantity: number;
  repeat: boolean;
  returnsAt: number;
  payment: number;
}

export interface HiredPilot {
  name: string;
  trip?: PilotTrip;
  message?: string;
}

export interface ParkedShip extends ShipIdentity {
  pilot?: HiredPilot;
  location: { x: number; y: number };
  ship: ShipState;
  inventory: Inventory;
  upgrades: Item[];
}
export interface Save {
  version: 4;
  progression: Progression;
  credits: number;
  wardrobe?: Wardrobe;
  activeShip: ShipIdentity;
  parkedShips: ParkedShip[];
  nextShipId: number;
  marketStocks: Record<string, Inventory>;
  settlements: Record<string, Settlement>;
  seed: string;
  mode: Mode;
  systemX: number;
  systemY: number;
  planetIndex: number;
  ship: ShipState;
  player: {
    hunger: number;
    sickness?: number;
    x: number;
    y: number;
    health: number;
    oxygen: number;
    energy: number;
  };
  inventory: Inventory;
  backpack: Inventory;
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
  basaltBerry: {
    name: "Baga de basalto",
    color: "#cf93e7",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  amberFig: {
    name: "Figo âmbar",
    color: "#e9ba63",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  frostPlum: {
    name: "Ameixa glacial",
    color: "#99ddef",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  jadePear: {
    name: "Pera de jade",
    color: "#c9e475",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  emberFruit: {
    name: "Fruta brasa",
    color: "#fa9868",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  tideMelon: {
    name: "Melão de maré",
    color: "#70dbb9",
    icon: "●",
    rarity: "Alimento",
    stack: 99,
  },
  sealedCargo: {
    name: "Carga clandestina",
    color: "#c39cf6",
    icon: "▣",
    rarity: "Contrabando",
    stack: 20,
  },
  rawMeat: {
    name: "Carne crua",
    color: "#ec9189",
    icon: "◆",
    rarity: "Alimento",
    stack: 99,
  },
  cookedMeat: {
    name: "Carne assada",
    color: "#eab17e",
    icon: "◆",
    rarity: "Alimento",
    stack: 99,
  },
  campfire: {
    name: "Fogueira",
    color: "#ffaf6c",
    icon: "▲",
    rarity: "Construção",
    stack: 99,
  },
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
  woodBlock: {
    name: "Bloco de madeira",
    color: "#c89e6e",
    icon: "▣",
    rarity: "Construção",
    stack: 99,
  },
  woodWall: {
    name: "Parede de madeira",
    color: "#ad835d",
    icon: "▥",
    rarity: "Construção",
    stack: 99,
  },
  stick: {
    name: "Graveto",
    color: "#c49a6c",
    icon: "╱",
    rarity: "Fabricado",
    stack: 99,
  },
  stickLadder: {
    name: "Escada de graveto",
    color: "#c49a6c",
    icon: "╪",
    rarity: "Construção",
    stack: 99,
  },
  woodHatch: {
    name: "Alçapão de madeira",
    color: "#ba9166",
    icon: "▱",
    rarity: "Construção",
    stack: 99,
  },
  woodStairs: {
    name: "Escada de madeira",
    color: "#d8b17e",
    icon: "◩",
    rarity: "Construção",
    stack: 99,
  },
  cabinet: {
    name: "Armário planetário",
    color: "#b6bd9c",
    icon: "▤",
    rarity: "Construção",
    stack: 99,
  },
  cabinetDouble: {
    name: "Armário planetário duplo",
    color: "#b6bd9c",
    icon: "▤",
    rarity: "Construção",
    stack: 99,
  },
  cabinetTriple: {
    name: "Armário planetário triplo",
    color: "#b6bd9c",
    icon: "▤",
    rarity: "Construção",
    stack: 99,
  },
  woodDoor: {
    name: "Porta de madeira",
    color: "#d0a176",
    icon: "▯",
    rarity: "Construção",
    stack: 99,
  },
  solarPanel: {
    name: "Placa solar",
    color: "#8ebfe9",
    icon: "▦",
    rarity: "Construção",
    stack: 99,
  },
  battery: {
    name: "Bateria estacionária",
    color: "#d6bd7e",
    icon: "▣",
    rarity: "Construção",
    stack: 99,
  },
  oxygenGenerator: {
    name: "Gerador de oxigênio",
    color: "#8edfc8",
    icon: "◉",
    rarity: "Construção",
    stack: 99,
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
    daySky: 0x91c5e2,
    ground: 0x605159,
    resources: "Ferro · Cobre · Silício",
    hazard: "Atmosfera rarefeita",
  },
  {
    name: "Desértico",
    color: 0xd6b47c,
    sky: 0x362936,
    daySky: 0xebc18e,
    ground: 0x9b7157,
    resources: "Silício · Cristais · Carbono",
    hazard: "Calor intenso",
  },
  {
    name: "Gelado",
    color: 0x99c7d8,
    sky: 0x182f4b,
    daySky: 0xbfe3f2,
    ground: 0x618b9e,
    resources: "Gelo · Cristais · Ferro",
    hazard: "Frio extremo",
  },
  {
    name: "Florestal",
    color: 0x7dab9b,
    sky: 0x172d35,
    daySky: 0xa8d2c3,
    ground: 0x526e65,
    resources: "Fibras · Madeira · Cobre",
    hazard: "Gravidade variável",
  },
  {
    name: "Vulcânico",
    color: 0xdb8064,
    sky: 0x351c2b,
    daySky: 0xdfab88,
    ground: 0x784954,
    resources: "Titânio · Carbono · Combustível",
    hazard: "Temperaturas extremas",
  },
  {
    name: "Oceânico",
    color: 0x6db8c3,
    sky: 0x152c48,
    daySky: 0x9bcfe5,
    ground: 0x527b88,
    resources: "Gelo · Silício · Fibras",
    hazard: "Cavernas costeiras",
  },
];
