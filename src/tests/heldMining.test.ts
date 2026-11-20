import { describe, expect, it } from "vitest";
import { HeldMining } from "../game/physics/heldMining";
describe("mineração contínua de blocos", () => {
  it("exige três segundos completos no mesmo bloco", () => {
    const mining = new HeldMining();
    expect(mining.advance("planeta:1,2,3", true, 1)).toEqual({
      progress: 1 / 3,
      complete: false,
    });
    expect(mining.advance("planeta:1,2,3", true, 1.999).complete).toBe(false);
    expect(mining.advance("planeta:1,2,3", true, 0.001)).toEqual({
      progress: 1,
      complete: true,
    });
  });
  it("reinicia ao soltar, mudar de bloco ou de planeta", () => {
    const mining = new HeldMining();
    mining.advance("A:1,2,3", true, 2);
    expect(mining.advance("A:1,2,3", false, 1)).toEqual({
      progress: 0,
      complete: false,
    });
    expect(mining.advance("A:1,2,3", true, 1).progress).toBe(1 / 3);
    expect(mining.advance("A:1,2,4", true, 1).progress).toBe(1 / 3);
    expect(mining.advance("B:1,2,4", true, 1).progress).toBe(1 / 3);
    mining.reset();
    expect(mining.advance("B:1,2,4", true, 1).complete).toBe(false);
  });
  it("permite quebra imediata com sabre e não depende da taxa de quadros", () => {
    const mining = new HeldMining();
    expect(mining.advance("A:1,2,3", true, 0, true).complete).toBe(true);
    for (const fps of [15, 30, 60]) {
      mining.reset();
      let result = { progress: 0, complete: false };
      for (let i = 0; i < fps * 3; i++)
        result = mining.advance("A:1,2,3", true, 1 / fps);
      expect(result.complete).toBe(true);
    }
  });
});
