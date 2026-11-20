import { describe, expect, it, vi } from "vitest";
import { Group, Mesh, Vector3, type BufferAttribute } from "three";
import { PlanetScanEffect } from "../game/rendering/PlanetScanEffect";
const origin = new Vector3(100, 80, 700),
  center = new Vector3(0, 0, 0),
  radius = 400;
function fan(effect: PlanetScanEffect) {
  return (effect.group.children[0] as Mesh).geometry.getAttribute(
    "position",
  ) as BufferAttribute;
}
describe("feixe de escaneamento planetário", () => {
  it("parte da nave e atinge a superfície esférica voltada para ela", () => {
    const effect = new PlanetScanEffect();
    try {
      expect(effect.group.visible).toBe(false);
      effect.update(origin, center, radius, 0.4);
      expect(effect.group.visible).toBe(true);
      const points = fan(effect);
      expect(new Vector3().fromBufferAttribute(points, 0)).toEqual(origin);
      for (let i = 1; i < points.count; i++) {
        const point = new Vector3().fromBufferAttribute(points, i);
        expect(point.distanceTo(center)).toBeCloseTo(radius * 1.018, 3);
        expect(
          point.clone().sub(center).dot(origin.clone().sub(center)),
        ).toBeGreaterThan(0);
      }
    } finally {
      effect.dispose();
    }
  });
  it("varre o planeta com o progresso, sem avançar quando a barra está pausada", () => {
    const effect = new PlanetScanEffect();
    try {
      effect.update(origin, center, radius, 0.25);
      const buffer = fan(effect),
        before = Array.from(buffer.array);
      effect.update(origin, center, radius, 0.25);
      expect(Array.from(fan(effect).array)).toEqual(before);
      effect.update(origin, center, radius, 0.6);
      expect(Array.from(fan(effect).array)).not.toEqual(before);
      expect(fan(effect)).toBe(buffer);
      effect.hide();
      expect(effect.group.visible).toBe(false);
    } finally {
      effect.dispose();
    }
  });
  it.each([
    new Vector3(0, 800, 0),
    new Vector3(0, 0, 0),
    new Vector3(-2000, -800, -300),
  ])("mantém geometria finita em qualquer altura e direção", (source) => {
    const effect = new PlanetScanEffect();
    try {
      for (const p of [0, 0.3, 0.75, 1]) {
        effect.update(source, center, radius, p);
        expect(Array.from(fan(effect).array).every(Number.isFinite)).toBe(true);
      }
    } finally {
      effect.dispose();
    }
  });
  it("libera geometria e materiais ao sair da cena", () => {
    const effect = new PlanetScanEffect(),
      scene = new Group();
    scene.add(effect.group);
    const mesh = effect.group.children[0] as Mesh;
    const geometry = vi.spyOn(mesh.geometry, "dispose");
    effect.dispose();
    expect(geometry).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
