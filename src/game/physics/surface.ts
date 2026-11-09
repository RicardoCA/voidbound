import type { Settlement } from "../types";
import type { Terrain } from "../procedural/terrain";
import { keyAt, blocksAir } from "../../construction/pieces";
export interface Actor {
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
}
export function solidCell(
  terrain: Terrain,
  settlement: Settlement,
  x: number,
  y: number,
) {
  return terrain.get(x, y) !== 0 || blocksAir(settlement, x, y);
}
export function stairFloor(settlement: Settlement, x: number, tileY: number) {
  const tx = Math.floor(x / 16),
    piece = settlement.pieces[keyAt(tx, tileY)];
  if (piece?.kind !== "woodStairs") return undefined;
  const offset = x - tx * 16;
  return tileY * 16 + (piece.facing === 1 ? 16 - offset : offset);
}
function clearBody(
  solid: (x: number, y: number) => boolean,
  x: number,
  y: number,
) {
  return [y - 11.9, y, y + 11.9].every(
    (height) => !solid(x - 4, height) && !solid(x + 4, height),
  );
}

export function stepClimb(
  actor: Pick<Actor, "x" | "y">,
  column: number | undefined,
  vertical: number,
  dt: number,
  terrain: Terrain,
  settlement: Settlement,
): (Actor & { fallDamage: number }) | undefined {
  if (column === undefined) {
    const center = Math.floor(actor.x / 16);
    for (const candidate of [center, center - 1, center + 1]) {
      const movement = stepClimb(
        actor,
        candidate,
        vertical,
        dt,
        terrain,
        settlement,
      );
      if (movement) return movement;
    }
    return undefined;
  }
  const x = column * 16 + 8;
  const piece = (row: number) => settlement.pieces[keyAt(column, row)];
  const onLadder = (y: number) => {
    for (
      let row = Math.floor((y - 12) / 16);
      row <= Math.floor((y + 12) / 16);
      row++
    ) {
      const tile = piece(row);
      if (tile?.kind === "stickLadder") return true;
      if (
        tile?.kind === "woodHatch" &&
        tile.open &&
        piece(row + 1)?.kind === "stickLadder"
      )
        return true;
    }
    return false;
  };
  const solid = (x: number, y: number) =>
    solidCell(terrain, settlement, Math.floor(x / 16), Math.floor(y / 16));
  if (
    Math.abs(actor.x - x) > 20 ||
    !onLadder(actor.y) ||
    !clearBody(solid, x, actor.y) ||
    !clearBody(solid, (actor.x + x) / 2, actor.y)
  )
    return;
  const dy = vertical * 66 * dt;
  const next = actor.y + dy;
  let y = actor.y;
  if (onLadder(next) && clearBody(solid, x, next)) y = next;
  else if (dy < 0) {
    // Stop with feet at the top edge so the player can step onto an adjacent floor.
    const edge = Math.floor((actor.y + 12) / 16) * 16 - 12;
    if (edge >= next && onLadder(edge) && clearBody(solid, x, edge)) y = edge;
  }
  return { x, y, vy: 0, grounded: false, fallDamage: 0 };
}

/** Small movement substeps prevent falling through built floors at high velocity. */
export function stepSurface(
  actor: Actor,
  direction: number,
  jump: boolean,
  gravity: number,
  dt: number,
  terrain: Terrain,
  settlement: Settlement,
) {
  const a = { ...actor };
  let fallDamage = 0;
  const solid = (x: number, y: number) =>
    solidCell(terrain, settlement, Math.floor(x / 16), Math.floor(y / 16));
  const clear = (x: number, y: number) => clearBody(solid, x, y);
  const nx = a.x + direction * 90 * dt;
  let stepY = a.y;
  if (a.grounded && !jump) {
    const feet = a.y + 12,
      row = Math.floor(feet / 16),
      floors: number[] = [];
    let nearRamp = false;
    for (const x of [nx - 4, nx, nx + 4])
      for (const y of [row - 1, row, row + 1]) {
        const ramp = stairFloor(settlement, x, y);
        if (ramp !== undefined && Math.abs(ramp - feet) <= 18) {
          nearRamp = true;
          floors.push(ramp);
        }
        if (
          solidCell(terrain, settlement, Math.floor(x / 16), y) &&
          Math.abs(y * 16 - feet) <= 18
        )
          floors.push(y * 16);
      }
    if (nearRamp)
      for (const floor of floors.sort((a, b) => a - b))
        if (clear(nx, floor - 12)) {
          stepY = floor - 12;
          break;
        }
  }
  if (clear(nx, stepY)) {
    a.x = nx;
    a.y = stepY;
  }
  if (jump && a.grounded) {
    a.vy = -190;
    a.grounded = false;
  }
  a.vy += 340 * gravity * dt;
  const steps = Math.max(1, Math.ceil(Math.abs(a.vy * dt) / 6)),
    dy = (a.vy * dt) / steps;
  a.grounded = false;
  for (let i = 0; i < steps; i++) {
    const nextY = a.y + dy;
    if (dy >= 0) {
      let floor: number | undefined;
      for (const x of [a.x - 4, a.x + 4])
        if (solid(x, nextY + 12)) {
          const top = Math.floor((nextY + 12) / 16) * 16;
          floor = floor === undefined ? top : Math.min(floor, top);
        }
      const from = Math.floor((a.y + 12 - 2) / 16),
        to = Math.floor((nextY + 12 + 2) / 16);
      for (let row = from; row <= to; row++) {
        const ramp = stairFloor(settlement, a.x, row);
        if (ramp !== undefined && a.y + 12 <= ramp + 2 && nextY + 12 >= ramp)
          floor = floor === undefined ? ramp : Math.min(floor, ramp);
      }
      if (floor !== undefined) {
        if (a.vy > 320) fallDamage = (a.vy - 320) * 0.08;
        a.y = floor - 12;
        a.vy = 0;
        a.grounded = true;
        break;
      }
    } else if (solid(a.x - 4, nextY - 12) || solid(a.x + 4, nextY - 12)) {
      a.y = (Math.floor((nextY - 12) / 16) + 1) * 16 + 12;
      a.vy = 0;
      break;
    }
    a.y = nextY;
  }
  return { ...a, fallDamage };
}
