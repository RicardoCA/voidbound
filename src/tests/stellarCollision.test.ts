import { expect, it } from "vitest";
import { resolveStellarCollision } from "../game/physics/stellarCollision";
import { deflectorFor, spatialStar, stellarExposure } from "../universe/stars";

it("applies heat outside the photosphere and leaves matching deflectors effective", () => {
  const star = { id: "test", kind: "yellow", x: 0, y: 0 } as const;
  const position = spatialStar(star, 0);
  const ship = { x: position.x + position.radius + 240, y: position.y };
  const zones = stellarExposure([star], ship, [], position.altitude);
  expect(zones[0]?.damage).toBeGreaterThan(0);
  expect(
    stellarExposure(
      [star],
      ship,
      [deflectorFor("yellow")],
      position.altitude,
    )[0]?.damage,
  ).toBe(0);
});

it("pushes a ship out of the star and reflects its inward vertical motion", () => {
  const star = { x: 0, y: 0, altitude: 0, radius: 500 };
  const ship = { x: 0, y: 0, altitude: 490, vx: 10, vy: 0, verticalSpeed: -50 };
  resolveStellarCollision(ship, star);
  expect(ship.altitude).toBe(548);
  expect(ship.verticalSpeed).toBeCloseTo(10);
  expect(ship.vx).toBe(10);
});
