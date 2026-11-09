import { BATTERY_CAP } from "../../construction/habitat";
import type Phaser from "phaser";
import type { Settlement, BuildItem, PlacedPiece } from "../types";
import type { SurfaceMaterial } from "./surfaceMaterials";
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
  g.fillStyle(0x172835, 0.32).fillEllipse(x + 4, base - 1, 33, 5);
  g.fillStyle(tree.trunk);
  g.fillRect(x - 4, top + 8, 8, height - 8);
  g.fillRect(x - 8, base - 5, 16, 5);
  g.fillStyle(tree.accent, 0.35);
  g.fillRect(x - 2, top + 12, 2, height - 16);
  g.fillStyle(0x2c2436, 0.45);
  g.fillRect(x + 2, top + 8, 2, height - 8);
  for (let bark = top + 27; bark < base - 5; bark += 7)
    g.fillRect(x - 3 + ((bark + tree.x) & 3), bark, 2, 4);
  g.fillStyle(tree.trunk);
  g.fillRect(x - 17, top + 25, 15, 4);
  g.fillRect(x + 3, top + 17, 16, 4);
  const foliage = (cx: number, cy: number, w: number, h: number) => {
    g.fillStyle(0x223244, 0.5).fillRect(
      cx - w / 2 + 3,
      cy + h / 2 - 2,
      w - 5,
      5,
    );
    g.fillStyle(tree.leaves);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillRect(cx - w / 2 + 4, cy - h / 2 - 4, w - 8, h + 8);
    g.fillStyle(tree.accent, 0.35);
    for (let tuft = 0; tuft < w - 6; tuft += 5) {
      const px = cx - w / 2 + 3 + tuft;
      g.fillStyle(tree.accent, 0.55).fillRect(
        px,
        cy - h / 2 + (tuft % 3),
        3,
        2,
      );
      g.fillStyle(0x26364b, 0.26).fillRect(px + 1, cy + (tuft % 5), 3, 2);
    }
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
        g.fillRect(x + sway - tier, y + 3, 4 + tier, 2);
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
  material: SurfaceMaterial,
  facing: 1 | -1 = 1,
  alpha = 1,
  state?: PlacedPiece,
) {
  g.fillStyle(material.timber, alpha);
  if (kind === "woodWall") {
    g.fillRect(x, y, 16, 16);
    g.fillStyle(material.shade, alpha * 0.5);
    g.fillRect(x, y, 16, 16);
    g.fillStyle(material.trim, alpha * 0.25);
    g.fillRect(x + 1, y + 2, 5, 1);
    g.fillRect(x + 9, y + 10, 5, 1);
    g.fillStyle(material.shade, alpha * 0.65);
    g.fillRect(x + 7, y, 1, 16);
    g.fillRect(x, y + 14, 16, 2);
    return;
  }
  if (kind === "woodBlock") {
    g.fillRect(x, y, 16, 16);
    g.fillStyle(material.trim, alpha);
    g.fillRect(x, y, 16, 2);
    g.fillStyle(material.shade, alpha * 0.75);
    g.fillRect(x, y + 14, 16, 2);
    g.fillRect(x + 3, y + 6, 9, 1);
    g.fillRect(x + 9, y + 10, 5, 1);
    return;
  }
  if (kind === "woodStairs") {
    for (let i = 0; i < 4; i++) {
      const sx = facing === 1 ? i * 4 : 12 - i * 4;
      g.fillStyle(material.timber, alpha);
      g.fillRect(x + sx, y + 12 - i * 4, 4, 4 + i * 4);
      g.fillStyle(material.trim, alpha);
      g.fillRect(x + sx, y + 12 - i * 4, 4, 1);
    }
    return;
  }
  if (kind === "woodDoor") {
    g.fillStyle(material.shade, alpha);
    g.fillRect(x, y - 16, 2, 32);
    g.fillRect(x + 14, y - 16, 2, 32);
    g.fillRect(x, y - 16, 16, 2);
    if (state?.open) {
      g.fillStyle(material.timber, alpha);
      g.fillRect(x + (facing === 1 ? 1 : 11), y - 14, 4, 30);
      g.fillStyle(0xf0d39a, alpha);
      g.fillRect(x + (facing === 1 ? 4 : 11), y + 1, 1, 2);
    } else {
      g.fillStyle(material.timber, alpha);
      g.fillRect(x + 2, y - 14, 12, 30);
      g.fillStyle(material.trim, alpha);
      g.fillRect(x + 4, y - 12, 8, 9);
      g.fillRect(x + 4, y + 1, 8, 10);
      g.fillStyle(0x51493f, alpha);
      g.fillRect(x + 11, y - 1, 2, 3);
    }
    return;
  }
  if (kind === "solarPanel") {
    g.fillStyle(material.shade, alpha);
    g.fillRect(x + 3, y + 12, 2, 4);
    g.fillRect(x + 11, y + 12, 2, 4);
    g.fillStyle(0x23456f, alpha);
    g.fillRect(x, y + 2, 16, 11);
    g.fillStyle(material.vein, alpha * 0.35);
    g.fillRect(x, y + 2, 16, 11);
    g.lineStyle(1, 0x8dbed6, alpha);
    g.strokeRect(x + 0.5, y + 2.5, 15, 10);
    g.lineBetween(x + 5, y + 3, x + 5, y + 12);
    g.lineBetween(x + 10, y + 3, x + 10, y + 12);
    g.lineBetween(x + 1, y + 7, x + 15, y + 7);
    g.fillStyle(0xc8e8ef, alpha * 0.55);
    g.fillRect(x + 1, y + 3, 3, 2);
    return;
  }
  if (kind === "campfire") {
    g.fillStyle(material.timber, alpha);
    g.fillRect(x + 1, y + 12, 14, 4);
    g.fillStyle(material.shade, alpha);
    g.fillRect(x + 1, y + 14, 14, 2);
    g.fillStyle(0xffac57, alpha * 0.18).fillEllipse(x + 8, y + 9, 16, 12);
    g.fillStyle(0xe77243, alpha);
    g.fillRect(x + 4, y + 7, 9, 6);
    g.fillRect(x + 7, y + 3, 4, 5);
    g.fillStyle(0xffcc79, alpha);
    g.fillRect(x + 7, y + 8, 4, 5);
    return;
  }
  if (kind === "battery") {
    g.fillStyle(material.vein, alpha);
    g.fillRect(x + 2, y + 3, 12, 13);
    g.fillStyle(material.trim, alpha);
    g.fillRect(x + 5, y + 1, 6, 2);
    g.fillStyle(0x172c39, alpha);
    g.fillRect(x + 4, y + 5, 8, 9);
    const charge = Math.max(0, Math.min(1, (state?.energy ?? 0) / BATTERY_CAP));
    g.fillStyle(charge > 0 ? 0x92d6c8 : 0x71574b, alpha);
    g.fillRect(
      x + 5,
      y + 13 - Math.round(charge * 7),
      6,
      Math.max(1, Math.round(charge * 7)),
    );
    return;
  }
  if (kind === "oxygenGenerator") {
    g.fillStyle(material.vein, alpha);
    g.fillRect(x + 1, y + 1, 14, 15);
    g.fillStyle(0x263d4a, alpha);
    g.fillRect(x + 3, y + 3, 10, 10);
    g.fillStyle(material.trim, alpha).fillRect(x + 2, y + 2, 12, 1);
    g.fillStyle(0x94d8c3, alpha);
    g.fillRect(x + 4, y + 5, 4, 7);
    g.fillStyle((state?.oxygen ?? 0) > 0 ? 0xa9f2cc : 0x64808d, alpha);
    g.fillRect(x + 10, y + 4, 2, 2);
    g.fillStyle(0x86d7dc, alpha);
    g.fillRect(x + 4, y + 13, Math.round((8 * (state?.oxygen ?? 0)) / 100), 1);
    return;
  }
  g.fillRect(x + 1, y + 1, 14, 15);
  g.fillStyle(material.shade, alpha);
  g.fillRect(x + 3, y + 3, 10, 11);
  g.fillStyle(material.timber, alpha);
  g.fillRect(x + 4, y + 4, 3, 9);
  g.fillRect(x + 9, y + 4, 3, 9);
  g.fillStyle(material.trim, alpha);
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
  material: SurfaceMaterial,
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
          material,
          piece.facing,
          1,
          piece.kind === "woodWall" ? undefined : piece,
        );
    }
}
