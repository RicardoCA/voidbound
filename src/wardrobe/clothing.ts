import type { Save } from "../game/types";

export type ClothingSlot = "hat" | "shirt" | "pants" | "visor" | "helmet";

interface Clothing {
  name: string;
  slot: ClothingSlot;
  price: number;
  color: number;
  trim: number;
  skull?: boolean;
  shell?: "scout" | "armored" | "industrial";
}

export const clothing = {
  auroraCap: {
    name: "Boné Aurora",
    slot: "hat",
    price: 90,
    color: 0x417989,
    trim: 0xa1efda,
  },
  ochreCap: {
    name: "Boné Garimpeiro",
    slot: "hat",
    price: 110,
    color: 0xaa7549,
    trim: 0xf3c37e,
  },
  patrolCap: {
    name: "Boné Patrulha",
    slot: "hat",
    price: 130,
    color: 0x3a5084,
    trim: 0x9abaf1,
  },
  corsairCap: {
    name: "Boné Corsário",
    slot: "hat",
    price: 170,
    color: 0x332c46,
    trim: 0xe2736a,
    skull: true,
  },
  explorerShirt: {
    name: "Camiseta Explorador",
    slot: "shirt",
    price: 120,
    color: 0x487f85,
    trim: 0xc5e8cb,
  },
  foundryShirt: {
    name: "Camiseta Forja",
    slot: "shirt",
    price: 150,
    color: 0x975838,
    trim: 0xf2bb71,
  },
  patrolShirt: {
    name: "Camiseta Patrulha",
    slot: "shirt",
    price: 160,
    color: 0x405b86,
    trim: 0xb8d8f3,
  },
  corsairShirt: {
    name: "Camiseta Caveira Pirata",
    slot: "shirt",
    price: 230,
    color: 0x363043,
    trim: 0xe8897a,
    skull: true,
  },
  cargoPants: {
    name: "Calça Cargueira",
    slot: "pants",
    price: 95,
    color: 0x66644b,
    trim: 0xcab784,
  },
  polarPants: {
    name: "Calça Polar",
    slot: "pants",
    price: 140,
    color: 0x8caebc,
    trim: 0xd7f1ef,
  },
  minerPants: {
    name: "Calça Garimpeira",
    slot: "pants",
    price: 145,
    color: 0x53616d,
    trim: 0xe2ae63,
  },
  corsairPants: {
    name: "Calça Corsário",
    slot: "pants",
    price: 180,
    color: 0x382d45,
    trim: 0xb86260,
  },
  nebulaCap: {
    name: "Boné Nebulosa",
    slot: "hat",
    price: 140,
    color: 0x744c91,
    trim: 0xdfb7ff,
  },
  tundraCap: {
    name: "Boné Tundra",
    slot: "hat",
    price: 155,
    color: 0x9bb8c9,
    trim: 0xebfaff,
  },
  mossCap: {
    name: "Boné Mata Estelar",
    slot: "hat",
    price: 125,
    color: 0x526747,
    trim: 0xbadf86,
  },
  neonCap: {
    name: "Boné Pulso Neon",
    slot: "hat",
    price: 200,
    color: 0x182c41,
    trim: 0x60ffdf,
  },
  nebulaShirt: {
    name: "Camiseta Nebulosa",
    slot: "shirt",
    price: 180,
    color: 0x674c87,
    trim: 0xd6b1ee,
  },
  tundraShirt: {
    name: "Camiseta Expedicionária",
    slot: "shirt",
    price: 185,
    color: 0x85a4ad,
    trim: 0xdcf5f6,
  },
  coralShirt: {
    name: "Camiseta Coral",
    slot: "shirt",
    price: 135,
    color: 0xa34c52,
    trim: 0xffc3a0,
  },
  neonShirt: {
    name: "Camiseta Pulso Neon",
    slot: "shirt",
    price: 215,
    color: 0x1d344c,
    trim: 0x72ffcf,
  },
  nebulaPants: {
    name: "Calça Nebulosa",
    slot: "pants",
    price: 165,
    color: 0x594368,
    trim: 0xce9fe5,
  },
  hazardPants: {
    name: "Calça Zona de Risco",
    slot: "pants",
    price: 175,
    color: 0x756044,
    trim: 0xffd46b,
  },
  coastalPants: {
    name: "Calça Costeira",
    slot: "pants",
    price: 130,
    color: 0x3d6874,
    trim: 0x8bdaca,
  },
  tacticalPants: {
    name: "Calça Tática",
    slot: "pants",
    price: 220,
    color: 0x263848,
    trim: 0xa9c7cc,
  },
  amberVisor: {
    name: "Viseira Âmbar",
    slot: "visor",
    price: 110,
    color: 0xc17b3c,
    trim: 0xffe2a3,
  },
  iceVisor: {
    name: "Viseira Glacial",
    slot: "visor",
    price: 130,
    color: 0x4e9fc3,
    trim: 0xe2faff,
  },
  nebulaVisor: {
    name: "Viseira Nebulosa",
    slot: "visor",
    price: 155,
    color: 0x9b65d5,
    trim: 0xf3d1ff,
  },
  corsairVisor: {
    name: "Viseira Corsária",
    slot: "visor",
    price: 180,
    color: 0xb04758,
    trim: 0xffc0a8,
  },
  jadeVisor: {
    name: "Viseira Jade",
    slot: "visor",
    price: 145,
    color: 0x429879,
    trim: 0xcfffb9,
  },
  obsidianVisor: {
    name: "Viseira Obsidiana",
    slot: "visor",
    price: 205,
    color: 0x373f69,
    trim: 0xb5c4f8,
  },
  graphiteCap: {
    name: "Boné Preto Grafite",
    slot: "hat",
    price: 135,
    color: 0x242a34,
    trim: 0x8b97a7,
  },
  eclipseCap: {
    name: "Boné Preto Eclipse",
    slot: "hat",
    price: 175,
    color: 0x151b28,
    trim: 0x8f70b5,
  },
  blacklineCap: {
    name: "Boné Preto Faixa Rubra",
    slot: "hat",
    price: 185,
    color: 0x202330,
    trim: 0xe7756d,
  },
  graphiteShirt: {
    name: "Camiseta Preta Grafite",
    slot: "shirt",
    price: 150,
    color: 0x252a33,
    trim: 0x8793a5,
  },
  eclipseShirt: {
    name: "Camiseta Preta Eclipse",
    slot: "shirt",
    price: 195,
    color: 0x181d2b,
    trim: 0x8870b3,
  },
  blacklineShirt: {
    name: "Camiseta Preta Faixa Rubra",
    slot: "shirt",
    price: 205,
    color: 0x202430,
    trim: 0xcc635f,
  },
  graphitePants: {
    name: "Calça Preta Grafite",
    slot: "pants",
    price: 140,
    color: 0x252b35,
    trim: 0x77889e,
  },
  eclipsePants: {
    name: "Calça Preta Eclipse",
    slot: "pants",
    price: 185,
    color: 0x181e2b,
    trim: 0x75629b,
  },
  blacklinePants: {
    name: "Calça Preta Faixa Rubra",
    slot: "pants",
    price: 195,
    color: 0x202631,
    trim: 0xbd5959,
  },
  graphiteVisor: {
    name: "Viseira Preta Grafite",
    slot: "visor",
    price: 155,
    color: 0x212934,
    trim: 0x7f90a1,
  },
  eclipseVisor: {
    name: "Viseira Preta Eclipse",
    slot: "visor",
    price: 195,
    color: 0x17182c,
    trim: 0x9e83d9,
  },
  blacklineVisor: {
    name: "Viseira Preta Faixa Rubra",
    slot: "visor",
    price: 220,
    color: 0x231d29,
    trim: 0xf07c71,
  },
  auroraHelmet: {
    name: "Capacete Aurora",
    slot: "helmet",
    price: 180,
    color: 0x509287,
    trim: 0xb2e5ca,
    shell: "scout",
  },
  polarHelmet: {
    name: "Capacete Polar",
    slot: "helmet",
    price: 210,
    color: 0x9caecb,
    trim: 0xedf7ff,
    shell: "scout",
  },
  foundryHelmet: {
    name: "Capacete Forja",
    slot: "helmet",
    price: 240,
    color: 0x935e37,
    trim: 0xffc483,
    shell: "industrial",
  },
  patrolHelmet: {
    name: "Capacete Patrulha",
    slot: "helmet",
    price: 260,
    color: 0x415f8b,
    trim: 0xa6c8ef,
    shell: "armored",
  },
  corsairHelmet: {
    name: "Capacete Corsário",
    slot: "helmet",
    price: 295,
    color: 0x332936,
    trim: 0xdf7771,
    shell: "armored",
  },
  eclipseHelmet: {
    name: "Capacete Preto Eclipse",
    slot: "helmet",
    price: 320,
    color: 0x202431,
    trim: 0x8e78b5,
    shell: "industrial",
  },
} satisfies Record<string, Clothing>;

export type ClothingId = keyof typeof clothing;
export type Outfit = Partial<Record<ClothingSlot, ClothingId>>;
export interface Wardrobe {
  owned: ClothingId[];
  equipped: Outfit;
}

export function buyClothing(state: Save, id: ClothingId) {
  const item = clothing[id];
  if (state.wardrobe?.owned.includes(id)) return "Você já possui essa peça.";
  if (state.credits < item.price) return "Créditos insuficientes.";
  const wardrobe = (state.wardrobe ??= { owned: [], equipped: {} });
  state.credits -= item.price;
  wardrobe.owned.push(id);
}

export function equipClothing(state: Save, id: ClothingId) {
  const wardrobe = state.wardrobe;
  if (!wardrobe?.owned.includes(id))
    return "Compre essa peça antes de equipar.";
  const { slot } = clothing[id];
  if (wardrobe.equipped[slot] === id) delete wardrobe.equipped[slot];
  else wardrobe.equipped[slot] = id;
}
