import type Phaser from "phaser";

type Graphics = Phaser.GameObjects.Graphics;

export const surfaceMaterials = [
  {
    rock: 0x53495a,
    shade: 0x302e42,
    vein: 0x827282,
    cap: 0xad8f86,
    ridge: 0x54536e,
    profile: [1, 0.48],
    timber: 0xa08270,
    trim: 0xd9aa89,
  },
  {
    rock: 0x986649,
    shade: 0x633f38,
    vein: 0xd09860,
    cap: 0xf3c98b,
    ridge: 0xa77565,
    profile: [0.59, 0.78],
    timber: 0xb38a52,
    trim: 0xf0c782,
  },
  {
    rock: 0x517990,
    shade: 0x304f71,
    vein: 0x9ed2df,
    cap: 0xdaeff3,
    ridge: 0x6f9ab8,
    profile: [1.2, 0.44],
    timber: 0x658596,
    trim: 0xb5dce3,
  },
  {
    rock: 0x4c544a,
    shade: 0x303c3a,
    vein: 0x778562,
    cap: 0xa8c573,
    ridge: 0x3e7465,
    profile: [0.82, 0.62],
    timber: 0x7e7250,
    trim: 0xbcc180,
  },
  {
    rock: 0x553644,
    shade: 0x2f2337,
    vein: 0x9c5560,
    cap: 0xe79068,
    ridge: 0x77515f,
    profile: [1.1, 0.35],
    timber: 0x875b50,
    trim: 0xd99062,
  },
  {
    rock: 0x446d75,
    shade: 0x294c5b,
    vein: 0x76a9a7,
    cap: 0xb8d8bb,
    ridge: 0x477f91,
    profile: [0.55, 0.55],
    timber: 0x678879,
    trim: 0xaad4b7,
  },
] as const;

export type SurfaceMaterial = (typeof surfaceMaterials)[number];

const oreColors = [
  0, 0, 0xb8cbd4, 0xe89765, 0xc6b2ec, 0x718497, 0x75dce3, 0xb388ee, 0xa5edff,
  0x9cca83, 0xc4ad78, 0xebca68,
];

export function drawTerrainTile(
  g: Graphics,
  material: SurfaceMaterial,
  biome: number,
  column: number,
  row: number,
  x: number,
  y: number,
  tile: number,
  exposed: boolean,
  textured: boolean,
  depositDrawn: boolean,
) {
  const seed = (Math.imul(column, 374761393) ^ Math.imul(row, 668265263)) >>> 0;
  const a = 2 + (seed & 3);
  const b = 8 + ((seed >>> 7) & 3);
  if (!textured) {
    g.fillStyle(material.rock).fillRect(x, y, 16, 16);
    g.fillStyle(material.shade, 0.48).fillRect(x, y + b + 2, 16, 14 - b);
    g.fillStyle(material.vein, 0.55);
    switch (biome) {
      case 0:
        g.fillRect(x + a, y + 3, 7, 2).fillRect(x + a - 1, y + 5, 4, 3);
        break;
      case 1:
        g.fillRect(x, y + a, b, 1).fillRect(x + b - 1, y + a + 1, 17 - b, 1);
        break;
      case 2:
        g.fillTriangle(x + a, y + 2, x + b + 2, y + 7, x + b, y + 13);
        break;
      case 3:
        g.fillRect(x + a, y + 2, 2, 6).fillRect(x + a + 2, y + 7, 4, 1);
        break;
      case 4:
        g.fillRect(x + a, y + 3, 5, 1)
          .fillRect(x + a + 4, y + 4, 2, 4)
          .fillRect(x + a + 6, y + 8, 5, 1);
        break;
      default:
        g.fillRect(x + a, y + 3, 3, 2).fillRect(x + b, y + 6, 4, 2);
    }
    g.fillStyle(material.vein, 0.35)
      .fillRect(x + b, y + 12, 2, 1)
      .fillRect(x + 1, y + 9, 2, 1);
  }
  if (exposed) {
    g.fillStyle(material.cap, textured ? 0.82 : 1)
      .fillRect(x, y, 16, 2)
      .fillRect(x + a, y + 2, b - a, 1);
  }
  if (depositDrawn) return;
  const ore = oreColors[tile];
  if (!ore) return;
  g.fillStyle(material.shade, 0.86)
    .fillRect(x + a - 1, y + 6, 6, 3)
    .fillRect(x + a, y + 5, 4, 5)
    .fillRect(x + b, y + 11, 5, 2)
    .fillRect(x + b + 1, y + 10, 3, 4);
  g.fillStyle(ore);
  if (tile === 7 || tile === 8 || tile === 6) {
    g.fillTriangle(x + a, y + 9, x + a + 2, y + 3, x + a + 5, y + 8);
    g.fillTriangle(x + b, y + 13, x + b + 2, y + 8, x + b + 4, y + 12);
  } else {
    g.fillRect(x + a, y + 7, 4, 2)
      .fillRect(x + a + 1, y + 6, 2, 3)
      .fillRect(x + b + 1, y + 11, 3, 2);
    g.fillStyle(ore, 0.6).fillRect(x + a + 5, y + 8, 1, 1);
  }
  g.fillStyle(0xfff5df, 0.55)
    .fillRect(x + a + 1, y + 6, 2, 1)
    .fillRect(x + b + 1, y + 11, 1, 1);
}
