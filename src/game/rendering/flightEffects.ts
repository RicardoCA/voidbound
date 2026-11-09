import type Phaser from "phaser";

type Graphics = Phaser.GameObjects.Graphics;

export function drawLandingGear(
  g: Graphics,
  x: number,
  y: number,
  scale: number,
  extension: number,
) {
  if (extension <= 0) return;
  const foot = y + (6 + 4 * extension) * scale;
  for (const offset of [-15, 10]) {
    const leg = x + offset * scale;
    g.lineStyle(3 * scale, 0x172639).lineBetween(
      leg,
      y - 5 * scale,
      leg + 2 * scale,
      foot,
    );
    g.lineStyle(scale, 0x9cb2bf).lineBetween(
      leg,
      y - 5 * scale,
      leg + 2 * scale,
      foot,
    );
    g.fillStyle(0x344a5b).fillRect(leg - 2 * scale, foot, 8 * scale, 2 * scale);
    g.fillStyle(0xdcb382).fillRect(leg + 3 * scale, foot, 2 * scale, scale);
  }
}

export function drawGroundWake(
  g: Graphics,
  x: number,
  ground: number,
  progress: number,
  color: number,
) {
  const opacity = Math.sin(Math.PI * progress);
  if (progress <= 0 || progress >= 1) return;
  const dust = ((color & 0xfefefe) >>> 1) + 0x6b5f50;
  for (let i = 0; i < 28; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = 10 + (22 + (i % 9) * 6) * progress;
    const rise = opacity * (2 + (i % 7) * 2);
    g.fillStyle(dust, opacity * (i % 3 === 0 ? 0.56 : 0.24)).fillRect(
      Math.round(x + side * (spread + (i % 3) * 2)),
      Math.round(ground - rise + (i % 5)),
      2 + (i % 5),
      1 + (i % 3),
    );
  }
}

export function drawBoardingRamp(
  g: Graphics,
  x: number,
  y: number,
  deployment: number,
) {
  if (deployment <= 0) return;
  const reach = Math.round(21 * deployment);
  const drop = Math.round(8 * deployment);
  g.fillStyle(0x172638).fillTriangle(
    x,
    y,
    x + reach,
    y + drop,
    x,
    y + drop + 3,
  );
  g.lineStyle(3, 0x536c80).lineBetween(x, y, x + reach, y + drop);
  g.lineStyle(1, 0xa6bdc3).lineBetween(x, y - 1, x + reach, y + drop - 1);
  for (let tread = 4; tread < reach; tread += 4) {
    g.fillStyle(tread % 8 ? 0x293e52 : 0xd4a568).fillRect(
      x + tread,
      y + Math.round((tread * drop) / reach),
      2,
      2,
    );
  }
}

export function drawDockingLane(
  g: Graphics,
  x: number,
  y: number,
  bearing: number,
  progress: number,
  scale: number,
) {
  const dx = Math.cos(bearing);
  const dy = Math.sin(bearing);
  const pulse = 0.4 + 0.6 * Math.sin(progress * Math.PI * 4) ** 2;
  for (const side of [-1, 1]) {
    for (let i = 1; i <= 7; i++) {
      const distance = (11 + i * 9) * scale;
      const width = (5 + i * 0.7) * scale * side;
      const bx = x + dx * distance - dy * width;
      const by = y + dy * distance + dx * width;
      g.fillStyle(0x61ded3, 0.12 * pulse).fillCircle(bx, by, 4 * scale);
      g.lineStyle(scale, i % 2 ? 0x96f5e5 : 0xf9c889, pulse).lineBetween(
        bx - dx * 2 * scale,
        by - dy * 2 * scale,
        bx + dx * 2 * scale,
        by + dy * 2 * scale,
      );
    }
  }
  const latch = Math.max(0, (progress - 0.75) / 0.25);
  g.lineStyle(scale, 0x9bf7d9, latch * 0.6).strokeCircle(
    x,
    y,
    (5 + 5 * latch) * scale,
  );
}
