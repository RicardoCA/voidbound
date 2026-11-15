import { expect, it } from "vitest";
import { resolveSpaceHull } from "../game/physics/spaceHull";

it("rebate a nave na lateral do casco rotacionado preservando a velocidade tangencial", () => {
  const ship = { x: 19, y: 3, vx: -8, vy: 4 };
  resolveSpaceHull(ship, { x: 0, y: 0 }, Math.PI / 2, 50, 20);
  expect(ship.x).toBeCloseTo(20.1);
  expect(ship.vx).toBeCloseTo(2);
  expect(ship.vy).toBeCloseTo(4);
});
