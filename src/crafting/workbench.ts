import type { Save } from "../game/types";
/** Surface crafting must be authorized by a real, reachable bench in this planet. */
export function workbenchInReach(state: Save, planetId: string, key: string) {
  if (
    state.mode !== "surface" ||
    state.settlements[planetId]?.pieces[key]?.kind !== "workbench"
  )
    return false;
  const [x, y, depth = 0] = key.split(",").map(Number);
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(depth)
  )
    return false;
  return (
    Math.hypot(
      (x! + 1) * 16 - state.player.x,
      y! * 16 + 8 - state.player.y,
      depth * 16 - (state.player.surfaceZ ?? 0),
    ) <= 76
  );
}
