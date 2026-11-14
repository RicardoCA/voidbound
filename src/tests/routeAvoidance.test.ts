import { expect, it } from "vitest";
import { avoidRouteObstacles } from "../game/physics/routeAvoidance";

it.each([
  { x: 130, y: 0, vx: 0, vy: 0, radius: 35 },
  { x: 120, y: 100, vx: 0, vy: -80, radius: 40 },
])("desvia ou freia diante de um obstáculo na trajetória", (obstacle) => {
  const ship = { x: 0, y: 0, vx: 60, vy: 0 };
  const desired = { x: 100, y: 0 };
  expect(avoidRouteObstacles(ship, desired, 65, [])).toEqual(desired);
  expect(avoidRouteObstacles(ship, desired, 65, [obstacle])).not.toEqual(
    desired,
  );
});
