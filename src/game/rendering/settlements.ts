import type Phaser from "phaser";
import type { Settlement, BuildItem } from "../types";
import type { AlienTree } from "../procedural/trees";
export function drawAlienTree(
  g: Phaser.GameObjects.Graphics,
  tree: AlienTree,
  screenX: number,
  groundY: number,
  time: number,
  damage = 0,
) {
  const x = Math.round(screenX),
    base = Math.round(groundY),
    height = tree.height * 16,
    top = base - height,
    sway = Math.round(Math.sin(time * 0.6 + tree.x) * 1.2),
    crown = tree.crown * 8;
  g.fillStyle(tree.trunk);
  g.fillRect(x - 4, top + 8, 8, height - 8);
  g.fillRect(x - 8, base - 5, 16, 5);
  g.fillStyle(tree.accent, 0.35);
  g.fillRect(x - 2, top + 12, 2, height - 16);
  g.fillStyle(tree.trunk);
  g.fillRect(x - 17, top + 25, 15, 4);
  g.fillRect(x + 3, top + 17, 16, 4);
  const foliage = (cx: number, cy: number, w: number, h: number) => {
    g.fillStyle(tree.leaves);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillRect(cx - w / 2 + 4, cy - h / 2 - 4, w - 8, h + 8);
    g.fillStyle(tree.accent, 0.35);
    g.fillRect(cx - w / 2 + 4, cy - h / 2, Math.max(4, w - 12), 3);
  };
  switch (tree.kind) {
    case 0:
      foliage(x - 13 + sway, top + 22, crown + 8, 12);
      foliage(x + 12 + sway, top + 12, crown + 10, 14);
      foliage(x + sway, top, 24, 14);
      break;
    case 1:
      foliage(x + sway, top + 3, crown * 2 + 14, 12);
      foliage(x - 12 + sway, top - 3, 24, 8);
      g.fillStyle(tree.accent);
      g.fillRect(x + 17, top + 10, 3, 5);
      break;
    case 2:
      for (let tier = 0; tier < 4; tier++) {
        const width = 12 + tier * 10,
          y = top + tier * 11;
        g.fillStyle(tree.leaves);
        g.fillTriangle(
          x + sway,
          y - 12,
          x - width / 2 + sway,
          y + 12,
          x + width / 2 + sway,
          y + 12,
        );
        g.fillStyle(tree.accent, 0.65);
        g.fillRect(x - width / 2 + 4 + sway, y + 9, width - 8, 3);
      }
      break;
    case 3:
      foliage(x - 13 + sway, top + 12, crown * 2, 26);
      foliage(x + 14 + sway, top + 3, crown * 2, 26);
      foliage(x + sway, top - 12, crown * 2, 26);
      if (tree.variant === 1) {
        g.fillStyle(tree.accent);
        g.fillRect(x + 18, top + 9, 4, 4);
      }
      break;
    case 4:
      g.fillStyle(tree.trunk);
      g.fillRect(x - 19, top, 4, 30);
      g.fillRect(x + 15, top - 6, 4, 27);
      foliage(x - 16 + sway, top - 2, 20, 16);
      foliage(x + 17 + sway, top - 9, 22, 18);
      foliage(x + sway, top + 11, 24, 18);
      g.fillStyle(tree.accent, 0.8);
      g.fillRect(x - 17, top - 7, 3, 3);
      g.fillRect(x + 16, top - 14, 3, 3);
      break;
    default:
      for (const side of [-1, 1])
        for (let branch = 0; branch < 3; branch++) {
          g.fillStyle(tree.leaves);
          g.fillRect(
            x + side * (8 + branch * 8) - 6 + sway,
            top - 6 + branch * 6,
            16,
            5,
          );
          g.fillStyle(tree.accent, 0.3);
          g.fillRect(x + side * 20, base - 12, 3, 12);
        }
      foliage(x + sway, top - 9, 18, 14);
  }
  if (damage) {
    g.lineStyle(1, 0xffd3a0, 0.75);
    g.lineBetween(x - 4, base - 22, x + 3, base - 16);
    g.lineBetween(x + 3, base - 16, x - 3, base - 11);
  }
}
export function drawPiece(
  g: Phaser.GameObjects.Graphics,
  kind: BuildItem,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
  alpha = 1,
) {
  g.fillStyle(kind === "woodWall" ? 0x72513e : 0xba8b59, alpha);
  if (kind === "woodWall") {
    g.fillRect(x, y, 16, 16);
    g.fillStyle(0x432f2c, alpha * 0.5);
    g.fillRect(x + 7, y, 1, 16);
    g.fillRect(x, y + 14, 16, 2);
    return;
  }
  if (kind === "woodBlock") {
    g.fillRect(x, y, 16, 16);
    g.fillStyle(0xe1b47e, alpha);
    g.fillRect(x, y, 16, 2);
    g.fillStyle(0x684735, alpha);
    g.fillRect(x, y + 14, 16, 2);
    g.fillRect(x + 3, y + 6, 9, 1);
    g.fillRect(x + 9, y + 10, 5, 1);
    return;
  }
  if (kind === "woodStairs") {
    for (let i = 0; i < 4; i++) {
      const sx = facing === 1 ? i * 4 : 12 - i * 4;
      g.fillStyle(0xb98c61, alpha);
      g.fillRect(x + sx, y + 12 - i * 4, 4, 4 + i * 4);
      g.fillStyle(0xf1c593, alpha);
      g.fillRect(x + sx, y + 12 - i * 4, 4, 1);
    }
    return;
  }
  g.fillRect(x + 1, y + 1, 14, 15);
  g.fillStyle(0x684834, alpha);
  g.fillRect(x + 3, y + 3, 10, 11);
  g.fillStyle(0xb58c63, alpha);
  g.fillRect(x + 4, y + 4, 3, 9);
  g.fillRect(x + 9, y + 4, 3, 9);
  g.fillStyle(0xeac585, alpha);
  g.fillRect(x + 6, y + 8, 1, 2);
  g.fillRect(x + 9, y + 8, 1, 2);
}
export function drawSettlement(
  g: Phaser.GameObjects.Graphics,
  data: Settlement,
  camX: number,
  camY: number,
  width: number,
  height: number,
  layer: "walls" | "pieces",
) {
  const minX = Math.floor((camX - width / 2) / 16) - 1,
    maxX = Math.ceil((camX + width / 2) / 16) + 1;
  const minY = Math.max(0, Math.floor((camY - height / 2) / 16) - 1),
    maxY = Math.min(63, Math.ceil((camY + height / 2) / 16) + 1);
  for (let tx = minX; tx <= maxX; tx++)
    for (let ty = minY; ty <= maxY; ty++) {
      const key = `${tx},${ty}`;
      const piece =
        layer === "walls"
          ? data.walls[key]
            ? { kind: "woodWall" as const, facing: 1 as const }
            : undefined
          : data.pieces[key];
      if (piece)
        drawPiece(
          g,
          piece.kind,
          Math.round(tx * 16 - camX + width / 2),
          Math.round(ty * 16 - camY + height / 2),
          piece.facing,
        );
    }
}
