import type Phaser from "phaser";
import type { CabinEquipment } from "./CabinInterior";

type Graphics = Phaser.GameObjects.Graphics;
type Project = (x: number, y: number, z?: number) => { x: number; y: number };

export function drawCabinDeck(g: Graphics, project: Project) {
  for (const [row, y] of [-43, -19, 5, 29].entries()) {
    for (let x = -180; x <= 156; x += 24) {
      const panel = [
        project(x, y),
        project(x + 23, y),
        project(x + 23, y + 23),
        project(x, y + 23),
      ];
      g.fillStyle((row + x / 12) % 3 === 0 ? 0x2b4556 : 0x233b4c).fillPoints(
        panel,
        true,
      );
      const [a, b] = panel;
      g.lineStyle(1, 0x557381, 0.55).lineBetween(a!.x, a!.y, b!.x, b!.y);
      const bolt = project(x + 3, y + 5);
      g.fillStyle(0x78919a, 0.55).fillRect(bolt.x, bolt.y, 1, 1);
      if ((x + row * 12) % 36 === 0) {
        g.fillStyle(0x162c3e, 0.7).fillRect(bolt.x + 6, bolt.y + 5, 4, 1);
        g.fillStyle(0x71848b, 0.35).fillRect(bolt.x + 9, bolt.y + 6, 3, 1);
      }
    }
  }
  for (const y of [-16, 23]) {
    const a = project(-184, y),
      b = project(184, y);
    g.lineStyle(2, 0x162b3b).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(1, 0x6da6a6, 0.72).lineBetween(a.x, a.y, b.x, b.y);
    for (let x = -166; x <= 166; x += 24) {
      const p = project(x, y);
      g.fillStyle(0x9ddcd0, 0.8).fillRect(p.x, p.y, 4, 1);
    }
  }
}

export function drawCabinBulkhead(g: Graphics, project: Project) {
  const wall = project(0, -62);
  const rect = (color: number, x: number, y: number, w: number, h: number) =>
    g.fillStyle(color).fillRect(wall.x + x, wall.y + y, w, h);
  for (let x = -177; x <= 110; x += 36) {
    rect(0x0d2030, x, -37, 34, 32);
    rect(0x344e61, x + 2, -35, 30, 26);
    rect(0x597583, x + 2, -35, 30, 1);
    rect(0x1b3346, x + 2, -12, 30, 3);
    rect(0x6f8991, x + 4, -32, 1, 1);
    rect(0x6f8991, x + 29, -14, 1, 1);
    for (let row = -27; row < -18; row += 3) {
      rect(0x162c3c, x + 9, row, 16, 1);
    }
  }
  rect(0x091928, -178, -6, 310, 5);
  rect(0x916641, -174, -5, 301, 1);
  rect(0x465e6c, -178, -1, 310, 1);

  // Recessed observation window and the illuminated cable channel below it.
  rect(0x0b1827, 0, -36, 116, 30);
  rect(0x76929c, 2, -36, 112, 2);
  rect(0x446777, 3, -34, 110, 25);
  rect(0x0c2134, 6, -32, 104, 20);
  rect(0x18384d, 7, -18, 102, 5);
  rect(0x617c88, 57, -32, 2, 20);
  rect(0xa4d9d2, 19, -26, 2, 1);
  rect(0x81adbb, 48, -21, 1, 1);
  rect(0xa4d9d2, 87, -27, 2, 2);
  rect(0x9e784e, 16, -8, 86, 2);
  rect(0x8bd6c9, 31, -6, 55, 1);
}

export function drawCabinFixture(
  g: Graphics,
  id: CabinEquipment,
  x: number,
  y: number,
  color: number,
  active: boolean,
) {
  const rect = (
    shade: number,
    dx: number,
    dy: number,
    w: number,
    h: number,
    alpha = 1,
  ) => g.fillStyle(shade, alpha).fillRect(x + dx, y + dy, w, h);
  rect(0x101e2c, -25, -2, 50, 6);
  rect(color, -24, 1, 48, 3, active ? 0.45 : 0.16);
  if (id === "hatch" || id === "inventory") {
    const h = id === "hatch" ? 38 : 26;
    rect(0x101d2d, -20, -h, 40, h);
    rect(0x75919c, -18, -h, 36, h - 2);
    rect(0x314c5c, -16, -h + 3, 32, h - 5);
    rect(0x526a73, -13, -h + 5, 12, h - 10);
    rect(0x425d69, 1, -h + 5, 12, h - 10);
    rect(0x213748, -1, -h + 5, 2, h - 9);
    rect(color, 7, -h + 8, 4, 2);
    rect(0x9e764c, -17, -4, 34, 2);
    for (const dx of [-14, 11]) rect(0x9ab0b6, dx, -h + 4, 1, 1);
    return;
  }
  rect(0x152838, -20, -15, 40, 15);
  rect(0x405e70, -18, -14, 36, 12);
  rect(0x6c8997, -22, -18, 40, 4);
  rect(0x263b4d, -16, -11, 32, 8);
  rect(color, -13, -9, 5, 1);
  rect(0x6e8791, 11, -5, 2, 1);
  if (id === "map") {
    rect(color, -19, -32, 38, 15, 0.11);
    g.lineStyle(1, color, 0.75).strokeEllipse(x, y - 27, 36, 12);
    g.lineStyle(1, color, 0.4).strokeEllipse(x, y - 27, 20, 7);
    rect(color, -1, -28, 3, 3);
    rect(color, 8, -31, 2, 2);
  } else if (id === "pilot") {
    rect(0x0c1f30, -8, -32, 16, 27);
    rect(0x6a8794, -6, -31, 12, 17);
    rect(0x314e60, -5, -28, 10, 11);
    rect(color, -4, -30, 8, 2);
    rect(0x7494a0, -10, -15, 20, 4);
  } else if (id === "solar") {
    for (const dx of [-13, 1]) {
      rect(0x142b3f, dx, -27, 12, 10);
      rect(0x4b6b7b, dx + 1, -27, 10, 8);
      rect(color, dx + 2, -25, 8, 2);
      rect(0x172e41, dx + 5, -26, 1, 7);
    }
  } else {
    rect(0x0b1d2a, -14, -28, 20, 10);
    rect(0x365966, -12, -27, 16, 8);
    rect(color, -10, -25, 11, 1);
    rect(color, -10, -22, 7, 1, 0.65);
    rect(0x9d754b, 9, -22, 7, 4);
    if (id === "craft") rect(0xb6c2b6, 10, -23, 6, 1);
  }
}
