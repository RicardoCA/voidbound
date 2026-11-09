import type { Inventory, Item, Save } from "../game/types";

export type WeaponModule = "gatling" | "plasma" | "railgun" | "scatter" | "ion";
export type ShipWeapon = "pulse" | WeaponModule;

interface WeaponProfile {
  name: string;
  label: string;
  color: string;
  damage: number;
  energy: number;
  cooldown: number;
  speed: number;
  range: number;
  life: number;
  angles: readonly number[];
  shieldMultiplier?: number;
}
interface WeaponUpgrade extends WeaponProfile {
  cost: Inventory;
  description: string;
}

export const weaponModules: Record<WeaponModule, WeaponUpgrade> = {
  gatling: {
    name: "Metralhadora orbital",
    label: "Gatling",
    color: "#ffd281",
    damage: 8,
    energy: 2,
    cooldown: 0.09,
    speed: 660,
    range: 310,
    life: 0.65,
    angles: [0],
    cost: { plate: 3, circuit: 1, carbon: 4 },
    description: "Disparos rápidos com baixo consumo por tiro.",
  },
  plasma: {
    name: "Canhão de plasma",
    label: "Plasma",
    color: "#ff976d",
    damage: 45,
    energy: 13,
    cooldown: 0.7,
    speed: 390,
    range: 280,
    life: 0.95,
    angles: [0],
    cost: { plate: 3, crystal: 4, cell: 2 },
    description: "Projétil lento com alto dano por impacto.",
  },
  railgun: {
    name: "Canhão eletromagnético",
    label: "Railgun",
    color: "#d2f0ff",
    damage: 32,
    energy: 9,
    cooldown: 0.52,
    speed: 920,
    range: 620,
    life: 0.95,
    angles: [0],
    cost: { titanium: 4, circuit: 3, copper: 6 },
    description: "Projétil de alta velocidade para combates a longa distância.",
  },
  scatter: {
    name: "Dispersor de fragmentos",
    label: "Dispersor",
    color: "#f6a9ce",
    damage: 11,
    energy: 7,
    cooldown: 0.42,
    speed: 500,
    range: 190,
    life: 0.48,
    angles: [-0.18, -0.09, 0, 0.09, 0.18],
    cost: { plate: 4, iron: 6, carbon: 3 },
    description: "Cinco projéteis em leque, mais eficazes de perto.",
  },
  ion: {
    name: "Canhão de íons",
    label: "Íons",
    color: "#9cd1ff",
    damage: 13,
    energy: 6,
    cooldown: 0.3,
    speed: 610,
    range: 360,
    life: 0.75,
    angles: [0],
    shieldMultiplier: 2.5,
    cost: { circuit: 3, cell: 2, silicon: 5 },
    description: "Causa 2,5× de dano aos escudos, com dano menor ao casco.",
  },
};

export const shipWeapons: Record<ShipWeapon, WeaponProfile> = {
  pulse: {
    name: "Laser de pulso",
    label: "Pulso",
    color: "#e0f8be",
    damage: 15,
    energy: 4,
    cooldown: 0.23,
    speed: 560,
    range: 340,
    life: 0.85,
    angles: [0],
  },
  ...weaponModules,
};

export function isWeaponModule(id: Item): id is WeaponModule {
  return Object.hasOwn(weaponModules, id);
}

export function selectedWeapon(state: Save): ShipWeapon {
  const id = state.ship.weapon;
  return id &&
    id !== "pulse" &&
    isWeaponModule(id) &&
    state.upgrades.includes(id)
    ? id
    : "pulse";
}

export function cycleWeapon(state: Save) {
  const installed: ShipWeapon[] = [
    "pulse",
    ...state.upgrades.filter(isWeaponModule),
  ];
  if (installed.length < 2) return false;
  const index = installed.indexOf(selectedWeapon(state));
  state.ship.weapon = installed[(index + 1) % installed.length];
  return true;
}
