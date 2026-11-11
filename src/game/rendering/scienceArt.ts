import type Phaser from "phaser";
import type { ScienceSite } from "../../progression/exploration";
import { hash } from "../procedural/random";

export function drawScienceSite(
  g: Phaser.GameObjects.Graphics,
  site: ScienceSite,
  x: number,
  y: number,
  time: number,
) {
  const rect = (color: number, dx: number, dy: number, w: number, h: number) =>
    g.fillStyle(color).fillRect(x + dx, y + dy, w, h);
  const variant = hash(site.id) % 3;
  if (site.kind === "ruin") {
    const glow = [0x67c9bc, 0xb195e6, 0xdfb783][variant]!;
    rect(0x18202c, -25, 10, 50, 3);
    rect(0x393b4d, -22, 6, 44, 4);
    rect(0x686779, -18, 3, 36, 3);
    if (variant === 0) {
      for (const side of [-1, 1]) {
        rect(0x393b4d, side * 12 - 4, -23, 8, 29);
        rect(0x77728b, side * 12 - 4, -23, 3, 26);
        rect(glow, side * 12, -17, 2, 13);
      }
      rect(0x48475d, -19, -28, 38, 7);
      rect(0x878095, -19, -28, 33, 2);
      rect(glow, -5, -24, 10, 2);
    } else {
      rect(0x3c3b51, -9, -27, 18, 32);
      rect(0x737087, -7, -32, 13, 7);
      rect(0x8c849e, -9, -26, 4, 28);
      rect(0x222339, 4, -24, 5, 27);
      rect(glow, -2, -21, 4, 9);
      rect(glow, -2, -8, 4, 3);
      rect(0x59566c, -20, -5, 7, 12);
      rect(0x59566c, 14, -9, 6, 15);
    }
    rect(0x282839, -7, -1, 7, 2);
    rect(0x282839, 10, 7, 8, 2);
    return;
  }

  const legendary = site.level > 1;
  const color = legendary ? 0xd9a2ff : 0x7fdbff;
  const dark = legendary ? 0x49316c : 0x235273;
  const radius = legendary ? 24 : 18;
  const phase = time * 1.65 + variant;
  g.fillStyle(dark, 0.22).fillCircle(x, y, radius + 9);
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + phase;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius * 0.57;
    const size = i % 5 === 0 ? 3 : 2;
    rect(
      i % 4 === 0 ? color : dark,
      Math.round(dx),
      Math.round(dy + dx * 0.25),
      size,
      size,
    );
  }
  const core = legendary ? 10 : 7;
  g.fillStyle(dark).fillPoints(
    [
      { x, y: y - core - 5 },
      { x: x + core, y },
      { x, y: y + core + 5 },
      { x: x - core, y },
    ],
    true,
  );
  rect(color, -2, -core + 1, 4, core * 2 - 2);
  rect(0xe7faff, -1, -3, 2, 6);
  if (legendary) {
    rect(color, -12, -11, 3, 3);
    rect(color, 10, 9, 3, 3);
  }
}
