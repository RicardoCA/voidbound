import { expect, it } from "vitest";
import { systemExists } from "../universe/generator";
import { jumpFuel, plotJumpRoute } from "../universe/jumpRoute";

it.each([2, 4])(
  "traça saltos de até %s anos-luz entre sistemas existentes",
  (range) => {
    const seed = "VOIDBOUND";
    const origin = { x: 0, y: 0 };
    const goal = { x: 14, y: -9 };
    const route = plotJumpRoute(seed, origin, goal, range, 20)!;
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual(goal);
    let previous = origin;
    for (const stop of route) {
      const distance = Math.hypot(stop.x - previous.x, stop.y - previous.y);
      expect(distance).toBeLessThanOrEqual(range);
      expect(jumpFuel(distance)).toBeLessThanOrEqual(20);
      if (stop !== route.at(-1))
        expect(systemExists(seed, stop.x, stop.y)).toBe(true);
      previous = stop;
    }
  },
);
