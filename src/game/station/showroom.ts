import { shipModels } from "../../fleet/models";
import { shipBlueprints } from "../../fleet/shipBlueprints";
import type { ShipModelId } from "../types";

export const showroomBays = (Object.keys(shipModels) as ShipModelId[])
  .filter((id) => !Object.hasOwn(shipBlueprints, id))
  .map((id, index) => ({
    id,
    x: index % 2 === 0 ? -83 : 83,
    z: -Math.floor(index / 2) * 112,
  }));

export const showroomSpawn = { x: 0, z: 63, heading: 0, stride: 0 };
export const showroomBack = showroomBays.at(-1)!.z - 63;

export function showroomPlaque(bay: (typeof showroomBays)[number]) {
  return { x: bay.x * 0.72, z: bay.z + 36 };
}

export function walkShowroom(
  pose: typeof showroomSpawn,
  horizontal: number,
  vertical: number,
  dt: number,
) {
  const step = (116 * dt) / Math.max(1, Math.hypot(horizontal, vertical));
  const canWalk = (x: number, z: number) =>
    Math.abs(x) < 148 && z > showroomBack && z < 88 &&
    !showroomBays.some((bay) =>
      Math.abs(x - bay.x) < 30 && Math.abs(z - bay.z) < 34,
    );
  const nextX = pose.x + horizontal * step;
  const nextZ = pose.z + vertical * step;
  const x = canWalk(nextX, pose.z) ? nextX : pose.x;
  const z = canWalk(x, nextZ) ? nextZ : pose.z;
  const moving = x !== pose.x || z !== pose.z;
  return {
    x,
    z,
    heading: moving ? Math.atan2(pose.x - x, pose.z - z) : pose.heading,
    stride: moving ? pose.stride + dt * 15 : 0,
  };
}

export function nearbyShowroomPlaque(pose: typeof showroomSpawn) {
  return showroomBays.find((bay) => {
    const plaque = showroomPlaque(bay);
    return Math.hypot(plaque.x - pose.x, plaque.z - pose.z) < 25;
  })?.id;
}
