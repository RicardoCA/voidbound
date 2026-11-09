import { hash, random } from "../game/procedural/random";

export const BLACK_HOLE_DURATION_MS = 15000;
export const BLACK_HOLE_PULL_RANGE = 300;
export const BLACK_HOLE_HORIZON = 34;

export interface BlackHole {
  id: string;
  x: number;
  y: number;
}

export function blackHoleAt(
  systemId: string,
  home: boolean,
): BlackHole | undefined {
  if (home || hash(systemId + ":black-hole") % 32 !== 0) return;
  return { id: systemId + ":black-hole", x: 430, y: -670 };
}

export function blackHoleDestination(
  seed: string,
  hole: BlackHole,
  x: number,
  y: number,
) {
  const rng = random(hash(hole.id + ":exit"));
  const angle = rng() * 2 * Math.PI;
  const distance = 6 + rng() * 8;
  const destination = {
    x: x + Math.round(Math.cos(angle) * distance),
    y: y + Math.round(Math.sin(angle) * distance),
  };
  while (hash(`${seed}:${destination.x}:${destination.y}:exists`) % 5 === 0)
    destination.x += destination.x >= x ? 1 : -1;
  return destination;
}

export function blackHolePull(hole: BlackHole, ship: { x: number; y: number }) {
  const dx = hole.x - ship.x,
    dy = hole.y - ship.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= BLACK_HOLE_PULL_RANGE) return;
  const acceleration = 260 * (1 - distance / BLACK_HOLE_PULL_RANGE) ** 1.6;
  return {
    captured: distance <= BLACK_HOLE_HORIZON,
    x: (acceleration * dx) / Math.max(1, distance),
    y: (acceleration * dy) / Math.max(1, distance),
  };
}
