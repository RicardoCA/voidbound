import type { Save } from "../game/types";

export type ClothingSlot = "hat" | "shirt" | "pants";

interface Clothing {
  name: string;
  slot: ClothingSlot;
  price: number;
  color: number;
  trim: number;
  skull?: boolean;
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
