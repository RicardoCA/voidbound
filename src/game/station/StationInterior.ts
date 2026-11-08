import Phaser from "phaser";
import { stationServices } from "./services";

const radiusX = 354;
const radiusY = 188;
const rise = 0.58;
const skew = 0.24;
const interactionRange = 36;

// Positions mark the approach side of each counter, from boarding clockwise.
const counters = [
  { x: -274, y: -38 },
  { x: -151, y: -54 },
  { x: -20, y: -71 },
  { x: 114, y: -52 },
  { x: 259, y: -35 },
  { x: 249, y: 84 },
  { x: 124, y: 125 },
  { x: -13, y: 139 },
  { x: -146, y: 121 },
  { x: -263, y: 78 },
] as const;
const spawn = counters[0];
const circle = Array.from({ length: 48 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

export class StationInterior {
  private x: number = spawn.x;
  private depth: number = spawn.y;
  private facing = 1;
  private stride = 0;
  private labels: Phaser.GameObjects.Text[] = [];

  reset() {
    this.x = spawn.x;
    this.depth = spawn.y;
    this.facing = 1;
    this.stride = 0;
  }

  hide() {
    for (const label of this.labels) label.setVisible(false);
  }

  private available(clandestine: boolean) {
    return clandestine ? counters.length : counters.length - 1;
  }

  walk(horizontal: number, vertical: number, dt: number, clandestine: boolean) {
    if (horizontal) this.facing = horizontal;
    const distance = (dt * 122) / Math.max(1, Math.hypot(horizontal, vertical));
    const canWalk = (x: number, y: number) =>
      (x / (radiusX - 10)) ** 2 + (y / (radiusY - 10)) ** 2 <= 1 &&
      !counters
        .slice(0, this.available(clandestine))
        .some(
          (counter) =>
            Math.abs(x - counter.x) < 25 && Math.abs(y - (counter.y - 23)) < 9,
        );
    const x = this.x + horizontal * distance;
    const depth = this.depth + vertical * distance;
    const oldX = this.x,
      oldDepth = this.depth;
    if (canWalk(x, this.depth)) this.x = x;
    if (canWalk(this.x, depth)) this.depth = depth;
    this.stride =
      this.x === oldX && this.depth === oldDepth ? 0 : this.stride + dt * 15;
  }

  nearby(clandestine: boolean) {
    let closest = interactionRange;
    let index = -1;
    for (let i = 0; i < this.available(clandestine); i++) {
      const counter = counters[i]!;
      const distance = Math.hypot(this.x - counter.x, this.depth - counter.y);
      if (distance < closest) {
        index = i;
        closest = distance;
      }
    }
    return stationServices[index];
  }

  draw(
    scene: Phaser.Scene,
    f: Phaser.GameObjects.Graphics,
    clandestine: boolean,
  ) {
    const { width, height } = scene.scale;
    const extent = Math.hypot(radiusX, radiusY * skew) + 12;
    const camera = Math.max(0, extent - width / 2);
    const cx =
      width / 2 -
      Phaser.Math.Clamp(this.x + this.depth * skew, -camera, camera);
    const cy = height * 0.55;
    const project = (x: number, y: number, z = 0) => ({
      x: Math.round(cx + x + y * skew),
      y: Math.round(cy + y * rise - z),
    });
    const fill = (color: number, x: number, y: number, w: number, h: number) =>
      f.fillStyle(color).fillRect(x, y, w, h);
    const polygon = (color: number, points: { x: number; y: number }[]) =>
      f.fillStyle(color).fillPoints(points, true);
    const oval = (color: number, rx: number, ry: number, z = 0) =>
      polygon(
        color,
        circle.map(({ x, y }) => project(x * rx, y * ry, z)),
      );

    fill(0x0a1321, 0, 0, width, height);
    oval(0x111e2e, radiusX, radiusY, -11);
    oval(0x597888, radiusX, radiusY);
    oval(0x304a5d, radiusX - 4, radiusY - 4);
    oval(0x142a3c, radiusX - 13, radiusY - 15);
    oval(0x213b4f, radiusX - 65, radiusY - 44);
    oval(0x1b3144, radiusX - 70, radiusY - 49);
    for (let i = 24; i < circle.length; i++) {
      const a = circle[i]!,
        b = circle[(i + 1) % circle.length]!;
      const x = a.x * radiusX,
        y = a.y * radiusY;
      const nx = b.x * radiusX,
        ny = b.y * radiusY;
      polygon(i % 2 ? 0x21374b : 0x1c3044, [
        project(x, y),
        project(nx, ny),
        project(nx, ny, 38),
        project(x, y, 38),
      ]);
      if (i % 3 !== 0)
        polygon(0x426677, [
          project(x, y, 31),
          project(nx, ny, 31),
          project(nx, ny, 34),
          project(x, y, 34),
        ]);
    }

    const center = project(0, 16);
    f.lineStyle(1, 0x547584, 0.6).strokeEllipse(center.x, center.y, 72, 32);
    polygon(0x3a6373, [
      project(0, -1),
      project(16, 16),
      project(0, 33),
      project(-16, 16),
    ]);
    polygon(0x6b9f9f, [
      project(0, 8),
      project(7, 16),
      project(0, 24),
      project(-7, 16),
    ]);

    const nearest = this.nearby(clandestine);
    const count = this.available(clandestine);
    const order = counters
      .slice(0, count)
      .map((counter, i) => ({ ...counter, i }))
      .sort((a, b) => a.y - b.y);
    let drawnPlayer = false;
    this.labels[count]?.setVisible(false);
    for (const counter of order) {
      if (!drawnPlayer && this.depth < counter.y - 15) {
        this.drawPlayer(fill, project(this.x, this.depth));
        drawnPlayer = true;
      }
      const npc = stationServices[counter.i]!;
      const { x, y } = project(counter.x, counter.y - 16);
      const visible = x > -70 && x < width + 70;
      this.labels[counter.i]?.setVisible(visible);
      if (!visible) continue;
      fill(0x122335, x - 26, y - 2, 53, 5);
      fill(0x8a9ea6, x - 6, y - 37, 9, 9);
      fill(0xd6b38f, x - 5, y - 35, 7, 6);
      fill(npc.color, x - 7, y - 28, 11, 12);
      fill(0x3e5467, x - 23, y - 14, 46, 14);
      fill(0x192b3b, x - 19, y - 9, 38, 6);
      polygon(0x688392, [
        project(counter.x - 23, counter.y - 29, 14),
        project(counter.x + 23, counter.y - 29, 14),
        { x: x + 23, y: y - 14 },
        { x: x - 23, y: y - 14 },
      ]);
      fill(npc.color, x - 23, y - 14, 46, 2);
      const label = (this.labels[counter.i] ??= scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "8px",
          align: "center",
          backgroundColor: "#101e2d",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5));
      label
        .setPosition(x, y - 47)
        .setText(nearest === npc ? npc.label + "\n◆ " + npc.name : npc.label)
        .setColor(nearest === npc ? "#a1f2db" : "#d5e5eb");
    }
    if (!drawnPlayer) this.drawPlayer(fill, project(this.x, this.depth));
  }

  private drawPlayer(
    fill: (color: number, x: number, y: number, w: number, h: number) => void,
    { x, y }: { x: number; y: number },
  ) {
    const step = this.stride ? Math.round(Math.sin(this.stride) * 2) : 0;
    fill(0x101c28, x - 8, y - 2, 16, 3);
    fill(0x597584, x - 6, y - 19, 4, 12);
    fill(0xc2d3dc, x - 4, y - 27, 9, 10);
    fill(0x88ded8, x - 1 + this.facing * 2, y - 25, 4, 4);
    fill(0x91aebc, x - 4, y - 17, 9, 10);
    fill(0xe1b77b, x - 4, y - 11, 9, 2);
    fill(0x7493a4, x - 3, y - 7, 3, 6 - step);
    fill(0x7493a4, x + 2, y - 7, 3, 6 + step);
  }
}
