import { systemExists } from "./generator";

export interface JumpPoint {
  x: number;
  y: number;
}

export function jumpFuel(distance: number) {
  return Math.ceil(distance * 8);
}

export function plotJumpRoute(
  seed: string,
  origin: JumpPoint,
  destination: JumpPoint,
  range: number,
  tank: number,
) {
  const key = ({ x, y }: JumpPoint) => `${x},${y}`;
  const distanceTo = ({ x, y }: JumpPoint) =>
    Math.hypot(destination.x - x, destination.y - y);
  const goal = key(destination);
  const steps: JumpPoint[] = [];
  const radius = Math.min(range, tank / 8);
  if (radius < 1) return;
  for (let x = -Math.floor(radius); x <= radius; x++)
    for (let y = -Math.floor(radius); y <= radius; y++)
      if ((x || y) && Math.hypot(x, y) <= radius) steps.push({ x, y });

  interface Node {
    point: JumpPoint;
    jumps: number;
    distance: number;
    previous?: Node;
  }
  const frontier: Node[] = [
    { point: origin, jumps: 0, distance: distanceTo(origin) },
  ];
  const best = new Map([[key(origin), 0]]);
  for (let attempts = 0; frontier.length && attempts < 4096; attempts++) {
    frontier.sort(
      (a, b) =>
        a.jumps +
          Math.ceil(a.distance / radius) -
          b.jumps -
          Math.ceil(b.distance / radius) || a.distance - b.distance,
    );
    const current = frontier.shift()!;
    if (key(current.point) === goal) {
      const route: JumpPoint[] = [];
      for (let node = current; node.previous; node = node.previous)
        route.unshift(node.point);
      return route;
    }
    if (current.jumps !== best.get(key(current.point))) continue;
    for (const offset of steps) {
      const point = {
        x: current.point.x + offset.x,
        y: current.point.y + offset.y,
      };
      const id = key(point);
      const jumps = current.jumps + 1;
      if (
        (best.get(id) ?? Infinity) <= jumps ||
        (id !== goal && !systemExists(seed, point.x, point.y))
      )
        continue;
      best.set(id, jumps);
      frontier.push({
        point,
        jumps,
        distance: distanceTo(point),
        previous: current,
      });
    }
  }
}
