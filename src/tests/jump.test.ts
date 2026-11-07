import { describe, it, expect } from "vitest";
import {
  JumpBuffer,
  queuePulse,
  takePulse,
  controls,
  releaseControls,
} from "../game/input";
describe("Entrada de pulo", () => {
  it("retém um toque rápido no frame anterior à aterrissagem e o executa uma única vez", () => {
    const buffer = new JumpBuffer();
    expect(buffer.take(true, false, 0.016)).toBe(false);
    expect(buffer.take(false, true, 0.016)).toBe(true);
    expect(buffer.take(false, true, 0.016)).toBe(false);
  });
  it("descarta pedidos antigos e não pula automaticamente depois de uma queda longa", () => {
    const buffer = new JumpBuffer();
    buffer.take(true, false, 0.016);
    for (let i = 0; i < 10; i++) buffer.take(false, false, 0.016);
    expect(buffer.take(false, true, 0.016)).toBe(false);
  });
  it("cancela o pulo pendente ao abrir uma interface ou mudar de modo", () => {
    const buffer = new JumpBuffer();
    buffer.take(true, false, 0.016);
    buffer.clear();
    expect(buffer.take(false, true, 0.016)).toBe(false);
  });
  it("enfileira o teclado sem manter o botão de toque pressionado", () => {
    releaseControls();
    queuePulse("jump");
    expect(controls.jump).toBe(false);
    expect(takePulse("jump")).toBe(true);
    expect(takePulse("jump")).toBe(false);
  });
});
