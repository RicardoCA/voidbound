import { shipHullFamilies } from "./models";

export const shipTextures = [...shipHullFamilies, "raider"] as const;
export type ShipTexture = (typeof shipTextures)[number];

export function shipTextureUrl(hull: ShipTexture) {
  return `${import.meta.env.BASE_URL}ships/${hull}.webp`;
}
