import type Phaser from "phaser";
import type { Terrain } from "../procedural/terrain";

export function drawSurfaceRidges(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  ground: number,
  light: number,
) {
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
      const y = Math.round(horizon - peak - Math.sin(i * 2.7 + layer) * 25);
      g.fillStyle(ground, alpha * (0.6 + 0.4 * light)).fillPoints(
        [
          { x: x - 36, y: horizon },
          { x: x + 17, y: y + 24 },
          { x: x + 44, y },
          { x: x + step + 38, y: horizon },
        ],
        true,
      );
      g.fillStyle(0x13233a, alpha * 0.42).fillTriangle(
        x + 44,
        y,
        x + 68,
        horizon,
        x + step + 38,
        horizon,
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
