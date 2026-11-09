import type Phaser from "phaser";

type Graphics = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };

export function drawStationHull(
  g: Graphics,
  x: number,
  y: number,
  beacon: boolean,
  scale = 1,
) {
  const rect = (
    color: number,
    dx: number,
    dy: number,
    w: number,
    h: number,
    alpha = 1,
  ) =>
    g
      .fillStyle(color, alpha)
      .fillRect(x + dx * scale, y + dy * scale, w * scale, h * scale);
  const face = (color: number, points: Point[]) =>
    g.fillStyle(color).fillPoints(
      points.map((p) => ({ x: p.x * scale + x, y: p.y * scale + y })),
      true,
    );

  // Rear truss and radiator banks.
  rect(0x142336, -57, -6, 114, 17);
  rect(0x506477, -56, -7, 112, 2);
  rect(0x0b1828, -58, 9, 116, 5);
  for (const side of [-1, 1]) {
    const bank = side < 0 ? -54 : 31;
    rect(0x162d46, bank, -18, 23, 33);
    rect(0x48758c, bank, -18, 23, 2);
    rect(0x304e68, bank + 1, -15, 21, 27);
    for (let row = -13; row <= 10; row += 4) {
      rect(0x102539, bank + 2, row, 19, 2);
      rect(0x5992a2, bank + 3, row + 2, 17, 1);
    }
    rect(0x8495a0, bank + 10, -18, 2, 33);
    rect(0xa2764a, bank + 3, 12, 6, 2);
  }

  // Pressurized modules, stepped plating and side-mounted tanks.
  face(0x182c41, [
    { x: -35, y: 9 },
    { x: 33, y: 9 },
    { x: 29, y: 21 },
    { x: -27, y: 21 },
  ]);
  rect(0x2e475e, -32, -11, 64, 24);
  rect(0x8396a2, -32, -11, 64, 2);
  for (const bay of [-31, 18]) {
    rect(0x536b7c, bay, -8, 13, 15);
    rect(0x263e54, bay + 1, 2, 11, 4);
    rect(0x92a5ab, bay + 2, -7, 8, 1);
    rect(0xc78d52, bay + 3, 8, 7, 2);
    for (let i = 0; i < 3; i++) rect(0x14293d, bay + 2 + i * 4, -4, 2, 4);
  }
  face(0x9aadb2, [
    { x: -21, y: -19 },
    { x: 13, y: -19 },
    { x: 22, y: -12 },
    { x: -26, y: -12 },
  ]);
  rect(0x617b8c, -26, -12, 48, 25);
  rect(0xa7b9ba, -24, -15, 37, 1);
  rect(0x5b7583, -17, -17, 26, 1);
  rect(0x788f9a, -24, -11, 13, 2);
  rect(0x859ba6, 3, -11, 12, 2);
  rect(0x21374b, -23, -9, 1, 16);
  rect(0x91a2a8, -20, -7, 2, 1);
  rect(0xa2b4bb, 18, -7, 2, 1);
  rect(0x324e60, -21, 5, 5, 1);
  rect(0x31495b, 16, 6, 5, 1);
  rect(0x2e475a, -25, 8, 46, 5);
  rect(0x435e71, 15, -11, 7, 19);
  rect(0x23384a, -24, -9, 45, 1);
  rect(0x142738, -15, -7, 30, 16);
  rect(0xa5794f, -15, -7, 30, 2);
  rect(0x101e2d, -12, -3, 24, 10);
  rect(0x345465, -10, 4, 20, 2);
  rect(0x73d5c4, -11, -2, 22, 7, 0.14);
  rect(0x70b3ad, -12, -2, 1, 8);
  rect(0x70b3ad, 11, -2, 1, 8);
  for (let i = -10; i <= 10; i += 5) rect(0xa7ddd6, i, -3, 2, 1);
  rect(0x496a7a, -7, -20, 13, 2);
  rect(0x516e7d, -1, -26, 2, 6);
  rect(0xf9bb73, -2, -27, 4, 1);
  for (const dx of [-22, 17]) {
    rect(0x81ddd4, dx - 2, 0, 8, 8, beacon ? 0.18 : 0.07);
    rect(beacon ? 0xffdc90 : 0x87d7ce, dx, 2, 3, 2);
    if (beacon) rect(0xffd890, dx - 1, 1, 5, 4, 0.18);
    rect(0x091929, dx, 10, 3, 2);
  }
  for (let i = 0; i < 5; i++)
    rect(i % 2 ? 0x233747 : 0xa97649, -10 + 4 * i, 13, 4, 2);
}

export function drawStationCounter(
  g: Graphics,
  x: number,
  y: number,
  color: number,
  service: string,
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
  rect(color, -29, -2, 58, 6, active ? 0.18 : 0.08);
  rect(0x132434, -21, -12, 42, 12);
  rect(0x456072, -19, -11, 38, 10);
  rect(0x243c4e, -18, -10, 12, 8);
  rect(0x253c4b, 8, -10, 10, 8);
  rect(0x101f2e, -4, -9, 10, 6);
  rect(color, -3, -8, 8, 1);
  for (const dx of [-17, -14, 10, 13]) rect(0x8197a0, dx, -4, 1, 1);
  rect(0xb4c2c3, -20, -14, 40, 1, 0.45);
  if (
    service === "market" ||
    service === "hangar" ||
    service === "black-market"
  ) {
    rect(0x202938, 10, -24, 13, 9);
    rect(0x886846, 11, -23, 11, 7);
    rect(0xc9975e, 12, -22, 9, 1);
    rect(0x4b3c35, 15, -22, 2, 6);
  } else if (service === "restricted-arms") {
    rect(0x221b25, 8, -27, 16, 12);
    rect(0x705045, 9, -26, 14, 10);
    rect(0x221b25, 10, -24, 12, 5);
    rect(color, 11, -23, 10, 2);
    rect(0x302932, 13, -21, 3, 3);
  } else if (service === "pirate-clothing") {
    rect(0x221b2b, 9, -27, 14, 12);
    rect(0x70404a, 10, -25, 12, 9);
    rect(color, 11, -24, 10, 2);
    rect(0xf2d0a8, 14, -21, 5, 3);
    rect(0x221b2b, 15, -20, 1, 1);
    rect(0x221b2b, 17, -20, 1, 1);
  } else if (service === "workshop" || service === "fuel") {
    rect(0x243746, 11, -25, 11, 10);
    rect(0x667b80, 12, -25, 8, 9);
    rect(color, 12, -22, 8, 2);
    rect(0x172b3b, 14, -27, 4, 2);
  } else {
    rect(0x142738, 9, -26, 13, 9);
    rect(0x355e69, 10, -25, 11, 7);
    rect(color, 12, -23, 7, 1);
    rect(color, 12, -21, 4, 1);
    rect(0x172b3b, 14, -17, 4, 2);
  }
}
