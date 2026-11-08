import type { ShipModelId } from "../game/types";
import { shipModels } from "./models";

export type ShipTexture = ShipModelId | "raider";
export const shipTextures: readonly ShipTexture[] = [
  ...(Object.keys(shipModels) as ShipModelId[]),
  "raider",
];

export function shipTextureUrl(hull: ShipTexture) {
  return `${import.meta.env.BASE_URL}ships/${hull}.webp`;
}
