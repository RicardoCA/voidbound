import { PlaneGeometry } from "three";
import { createNoise3D } from "simplex-noise";
import { random } from "../procedural/random";
import type { Planet } from "../types";

export function landingTerrain(planet: Planet, site: number) {
  const geometry = new PlaneGeometry(1700, 1700, 64, 64);
  geometry.rotateX(-Math.PI / 2);
  const noise = createNoise3D(random(planet.seed + site));
  const vertices = geometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const z = vertices.getZ(i);
    const distance = Math.hypot(x, z);
    const edge = Math.min(1, Math.max(0, (distance - 80) / 180));
    const relief =
      (planet.kind === 1 ? 36 : 74) * noise(x / 220, z / 220, 1) +
      19 * noise(x / 70, z / 70, 2);
    vertices.setY(i, relief * edge);
  }
  geometry.computeVertexNormals();
  return geometry;
}
