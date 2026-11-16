import { afterEach, expect, it } from "vitest";
import { flightSteering, releaseControls, setTouchSteering, touchSteering } from "../game/input";

afterEach(releaseControls);

it("ignora desvios pequenos e aumenta o giro com a distância do centro", () => {
  setTouchSteering(.19);
  expect(flightSteering(0, .1)).toBe(0);
  setTouchSteering(.4);
  const gentle = flightSteering(0, .1);
  expect(gentle).toBeGreaterThan(0);
  expect(gentle).toBeLessThan(.15);
  setTouchSteering(1);
  expect(flightSteering(0, .1)).toBeGreaterThan(gentle);
});

it("desacelera o giro ao soltar e mantém a resposta imediata do teclado", () => {
  setTouchSteering(-1);
  const turn = flightSteering(0, .1);
  setTouchSteering(0);
  expect(flightSteering(0, .1)).toBeGreaterThan(turn);
  expect(flightSteering(0, .4)).toBe(0);
  expect(flightSteering(1, .016)).toBe(1);
  expect(touchSteering.turn).toBe(0);
});
