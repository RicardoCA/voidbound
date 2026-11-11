import { openSurfacePosition } from "../construction/openSurfacePosition";
import type { Terrain } from "../game/procedural/terrain";
import type { Settlement } from "../game/types";

export function representativePosition(
  terrain: Terrain,
  settlement: Settlement,
  landingX: number,
) {
  return openSurfacePosition(terrain, settlement, landingX + 6, 1, landingX);
}
