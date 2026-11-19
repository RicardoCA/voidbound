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

it("suaviza o arrasto de direção e limita a rotação por quadro", async () => {
  const { dragFlightLook, stepFlightLook, touchFlightLook } = await import("../game/input");
  dragFlightLook(1000, -1000);
  const turn = stepFlightLook(.016);
  expect(turn.yaw).toBeGreaterThan(0);
  expect(turn.yaw).toBeLessThanOrEqual(.016 * 1.3);
  expect(turn.pitch).toBeGreaterThan(0);
  expect(turn.pitch).toBeLessThanOrEqual(.016);
  releaseControls();
  expect(touchFlightLook).toEqual({ yaw: 0, pitch: 0 });
  expect(stepFlightLook(.016)).toEqual({ yaw: 0, pitch: 0 });
});

it("faz a colossal virar mais lentamente com o mesmo arrasto", async () => {
  const { dragFlightLook, stepFlightLook } = await import("../game/input");
  dragFlightLook(80, 0);
  const normal = stepFlightLook(.016).yaw;
  releaseControls();
  dragFlightLook(80, 0);
  expect(stepFlightLook(.016, .6).yaw).toBeLessThan(normal);
});
