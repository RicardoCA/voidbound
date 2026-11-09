import type Phaser from "phaser";
import type { SurfaceMaterial } from "./surfaceMaterials";
import type { Terrain } from "../procedural/terrain";

export function drawSurfaceRidges(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  material: SurfaceMaterial,
  light: number,
) {
  const [rise, slope] = material.profile;
  const layers = [
    { step: 115, parallax: 0.08, peak: 128, alpha: 0.18 },
    { step: 90, parallax: 0.2, peak: 96, alpha: 0.28 },
    { step: 68, parallax: 0.35, peak: 62, alpha: 0.34 },
  ];
  for (const [layer, { step, parallax, peak, alpha }] of layers.entries()) {
    const scroll = cameraX * parallax;
    const first = Math.floor(scroll / step) - 1;
    const horizon = Math.round(
      height * (0.76 + layer * 0.07) - Math.sin(cameraY / 240) * 8,
    );
    for (let i = first; i <= first + Math.ceil(width / step) + 2; i++) {
      const x = Math.round(i * step - scroll);
      const y = Math.round(
        horizon - peak * rise - Math.sin(i * 2.7 + layer) * 20,
      );
      const summit = x + Math.round(step * slope);
      const shoulder = y + Math.round(peak * 0.27);
      const toe = x + step + 38;
      g.fillStyle(material.ridge, alpha * (0.6 + 0.4 * light)).fillPoints(
        [
          { x: x - 36, y: horizon },
          { x: summit - 23, y: shoulder },
          { x: summit, y },
          { x: summit + 17, y: shoulder + 3 },
          { x: toe, y: horizon },
        ],
        true,
      );
      g.fillStyle(material.shade, alpha * 0.55).fillTriangle(
        summit,
        y,
        summit + 12,
        horizon,
        toe,
        horizon,
      );
      g.fillStyle(material.cap, alpha * light * 0.38).fillTriangle(
        summit,
        y,
        summit - 23,
        shoulder,
        summit + 17,
        shoulder + 3,
      );
    }
  }
}

export function drawTerrainDepth(
  g: Phaser.GameObjects.Graphics,
  terrain: Terrain,
  column: number,
  row: number,
  x: number,
  y: number,
  color: number,
  light: number,
) {
  const corner = { x: x + 16, y };
  const back = { x: x + 22, y: y - 7 };
  if (!terrain.get(column, row - 1)) {
    g.fillStyle(color, 0.62 + light * 0.3).fillPoints(
      [{ x, y }, corner, back, { x: x + 6, y: y - 7 }],
      true,
    );
  }
  if (!terrain.get(column + 1, row)) {
    g.fillStyle(color).fillPoints(
      [corner, back, { x: x + 22, y: y + 9 }, { x: x + 16, y: y + 16 }],
      true,
    );
    g.fillStyle(0x122135, 0.5).fillPoints(
      [corner, back, { x: x + 22, y: y + 9 }, { x: x + 16, y: y + 16 }],
      true,
    );
  }
}
