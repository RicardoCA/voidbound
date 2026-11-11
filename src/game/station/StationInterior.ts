import Phaser from "phaser";
import { drawStationCounter } from "./stationArt";
import { stationServices, stationServicesFor } from "./services";

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
  { x: -146, y: 34 },
  { x: -263, y: 78 },
  { x: -151, y: -54 }, // Pirate clothier uses the vacant regular-market bay.
  { x: 124, y: 125 }, // The recruiter uses the vacant science bay.
  { x: -20, y: -71 }, // The arms dealer uses the vacant dealership bay.
] as const;
function countersFor(clandestine: boolean) {
  return stationServicesFor(clandestine).map((npc) => {
    const i = stationServices.indexOf(npc);
    return { ...counters[i]!, npc, i };
  });
}
const standardCounters = countersFor(false);
const clandestineCounters = countersFor(true);
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
    this.labels.forEach((label) => label.setVisible(false));
  }

  walk(horizontal: number, vertical: number, dt: number, clandestine: boolean) {
    if (horizontal) this.facing = horizontal;
    const distance = (dt * 122) / Math.max(1, Math.hypot(horizontal, vertical));
    const canWalk = (x: number, y: number) =>
      (x / (radiusX - 10)) ** 2 + (y / (radiusY - 10)) ** 2 <= 1 &&
      !(clandestine ? clandestineCounters : standardCounters).some(
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
    let nearest;
    for (const counter of clandestine
      ? clandestineCounters
      : standardCounters) {
      const distance = Math.hypot(this.x - counter.x, this.depth - counter.y);
      if (distance < closest) {
        closest = distance;
        nearest = counter.npc;
      }
    }
    return nearest;
  }

  draw(
    scene: Phaser.Scene,
    f: Phaser.GameObjects.Graphics,
    clandestine: boolean,
    drawAstronaut: (x: number, y: number, walk: number, facing: number) => void,
    conversation = "",
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
    oval(clandestine ? 0x98616a : 0x597888, radiusX, radiusY);
    oval(clandestine ? 0x653b49 : 0x304a5d, radiusX - 4, radiusY - 4);
    oval(0x142a3c, radiusX - 13, radiusY - 15);
    oval(clandestine ? 0x603b49 : 0x213b4f, radiusX - 65, radiusY - 44);
    oval(clandestine ? 0x332636 : 0x1b3144, radiusX - 70, radiusY - 49);
    // Deck seams and scuffs are anchored to the hall, not the camera.
    for (let depth = -140; depth <= 155; depth += 24) {
      for (let x = -304; x < 305; x += 30) {
        if ((x / 320) ** 2 + (depth / 167) ** 2 > 0.88) continue;
        const start = project(x, depth);
        const end = project(x + 26, depth);
        if (end.x < 0 || start.x > width) continue;
        f.lineStyle(1, 0x102337, 0.62).lineBetween(
          start.x,
          start.y,
          end.x,
          end.y,
        );
        f.lineStyle(1, 0x64808b, 0.27).lineBetween(
          start.x,
          start.y + 1,
          end.x,
          end.y + 1,
        );
        fill(0x13293a, start.x + 3, start.y + 4, 2, 1);
        fill(0x435965, end.x - 3, start.y + 5, 1, 1);
      }
    }
    for (let i = 0; i < 24; i++) {
      const edge = circle[i]!;
      const marker = project(edge.x * (radiusX - 8), edge.y * (radiusY - 7));
      if (marker.x >= 0 && marker.x <= width) {
        fill(0x0a1a29, marker.x - 4, marker.y - 1, 8, 3);
        fill(i % 3 === 0 ? 0xe3ad66 : 0x6fb2b7, marker.x - 2, marker.y, 4, 1);
      }
    }
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
      const panel = (
        shade: number,
        left: number,
        right: number,
        low: number,
        high: number,
      ) => {
        const point = (t: number, z: number) =>
          project(x + (nx - x) * t, y + (ny - y) * t, z);
        polygon(shade, [
          point(left, low),
          point(right, low),
          point(right, high),
          point(left, high),
        ]);
      };
      panel(0x101e2e, 0.03, 0.95, 8, 30);
      panel(i % 3 === 0 ? 0x426074 : 0x2c485c, 0.12, 0.87, 10, 28);
      panel(0x62818d, 0.09, 0.9, 28, 30);
      panel(0x101d2a, 0.02, 0.12, 0, 38);
      panel(0x64808e, 0.15, 0.24, 12, 14);
      if (i % 3 === 0) {
        panel(0x091b2d, 0.24, 0.78, 14, 25);
        panel(0x83d8cf, 0.4, 0.51, 21, 22);
      } else {
        for (let z = 14; z <= 23; z += 3) panel(0x192b3d, 0.36, 0.78, z, z + 1);
      }
      panel(i % 4 === 0 ? 0xe3b173 : 0x70b8bc, 0.22, 0.8, 33, 35);
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
    const order = [
      ...(clandestine ? clandestineCounters : standardCounters),
    ].sort((a, b) => a.y - b.y);
    const drawPlayer = () => {
      const p = project(this.x, this.depth);
      fill(0x101c28, p.x - 8, p.y - 2, 16, 3);
      drawAstronaut(p.x, p.y - 12, Math.sin(this.stride) * 2, this.facing);
    };
    let drawnPlayer = false;
    this.hide();
    for (const counter of order) {
      if (!drawnPlayer && this.depth < counter.y - 15) {
        drawPlayer();
        drawnPlayer = true;
      }
      const npc = counter.npc;
      const { x, y } = project(counter.x, counter.y - 16);
      const visible = x > -70 && x < width + 70;
      this.labels[counter.i]?.setVisible(visible);
      if (!visible) continue;
      fill(0x122335, x - 26, y - 2, 53, 5);
      fill(0x8a9ea6, x - 6, y - 37, 9, 9);
      fill(0xd6b38f, x - 5, y - 35, 7, 6);
      fill(npc.color, x - 7, y - 28, 11, 12);
      fill(0x344959, x + 1, y - 27, 3, 9);
      fill(0x1a2c3b, x - 5, y - 22, 5, 2);
      fill(0xb5d5d4, x - 4, y - 32, 4, 1);
      fill(0x3e5467, x - 23, y - 14, 46, 14);
      fill(0x192b3b, x - 19, y - 9, 38, 6);
      polygon(0x688392, [
        project(counter.x - 23, counter.y - 29, 14),
        project(counter.x + 23, counter.y - 29, 14),
        { x: x + 23, y: y - 14 },
        { x: x - 23, y: y - 14 },
      ]);
      fill(npc.color, x - 23, y - 14, 46, 2);
      drawStationCounter(f, x, y, npc.color, npc.id, nearest === npc);
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
    if (!drawnPlayer) drawPlayer();
    const target = order.find(
      ({ npc }) => conversation === "station:" + npc.id,
    );
    if (target) return project(target.x, target.y - 16, 39);
  }
}
