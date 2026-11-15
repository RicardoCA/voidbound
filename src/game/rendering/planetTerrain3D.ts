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
    const broad = noise(x / 220, z / 220, 1);
    const detail = noise(x / 70, z / 70, 2);
    const relief = [
      74 * broad + 19 * detail,
      42 * noise(x / 330, z / 115, 1) + 7 * detail,
      102 * broad + 23 * Math.abs(detail),
      51 * broad + 22 * detail,
      122 * Math.max(-.32, broad) + 27 * detail,
      44 * Math.max(-.42, broad) + 9 * detail,
    ][planet.kind]!;
    vertices.setY(i, relief * edge);
  }
  geometry.computeVertexNormals();
  return geometry;
}
