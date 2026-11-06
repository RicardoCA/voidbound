import { describe, it, expect } from "vitest";
import { logicalViewport } from "../game/rendering/viewport";
describe("Viewport móvel", () => {
  it("mantém a resolução de referência no desktop", () =>
    expect(logicalViewport(1440, 900, false)).toEqual({
      width: 480,
      height: 270,
    }));
  it.each([
    [844, 228],
    [667, 228],
    [390, 564],
    [320, 468],
  ])(
    "preenche %i × %i sem cortar a visão base nem distorcer",
    (width, height) => {
      const logical = logicalViewport(width, height, true);
      expect(logical.width).toBeGreaterThanOrEqual(480);
      expect(logical.height).toBeGreaterThanOrEqual(270);
      const scale = Math.min(width / logical.width, height / logical.height);
      expect(Math.abs(logical.width * scale - width)).toBeLessThan(2);
      expect(Math.abs(logical.height * scale - height)).toBeLessThan(2);
    },
  );
  it("tolera dimensões zeradas durante uma mudança de orientação", () =>
    expect(logicalViewport(0, 0, true)).toEqual({ width: 480, height: 270 }));
});
