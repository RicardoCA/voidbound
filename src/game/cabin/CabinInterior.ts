import type Phaser from "phaser";
import { drawCabinBulkhead, drawCabinDeck, drawCabinFixture } from "./cabinArt";

export const cabinEquipment = {
  hatch: {
    x: -145,
    y: -24,
    label: "Escotilha",
    action: "EXPLORAR SUPERFÍCIE",
    color: 0x88ded8,
  },
  craft: {
    x: 0,
    y: -24,
    label: "Bancada e refinaria",
    action: "Abrir fabricação",
    color: 0xe1b77b,
  },
  pilot: {
    x: 145,
    y: -24,
    label: "Cadeira do piloto",
    action: "Sentar na cadeira do piloto",
    color: 0x89b6da,
  },
  solar: {
    x: -145,
    y: 34,
    label: "Recuperação solar",
    action: "Recuperação solar (+60 s)",
    color: 0xd8ba70,
  },
  inventory: {
    x: 0,
    y: 34,
    label: "Armário de carga",
    action: "Abrir carga e melhorias",
    color: 0x96b4a5,
  },
  bases: {
    x: 145,
    y: 34,
    label: "Terminal de bases",
    action: "Abrir bases e depósitos",
    color: 0xb3a1da,
  },
  map: {
    x: 0,
    y: 5,
    label: "Mapa galáctico",
    action: "Abrir mapa galáctico",
    color: 0x88d9e4,
  },
} as const;

export type CabinEquipment = keyof typeof cabinEquipment;
const fixtures = Object.entries(cabinEquipment) as [
  CabinEquipment,
  (typeof cabinEquipment)[CabinEquipment],
][];
const fixturesByDepth = [...fixtures].sort(([, a], [, b]) => a.y - b.y);
const hull = [
  { x: -204, y: -35 },
  { x: -184, y: -62 },
  { x: 135, y: -62 },
  { x: 207, y: -34 },
  { x: 207, y: 30 },
  { x: 135, y: 62 },
  { x: -184, y: 62 },
  { x: -204, y: 35 },
];

export class CabinInterior {
  private x: number = cabinEquipment.hatch.x;
  private y: number = cabinEquipment.hatch.y;
  private facing = 1;
  private stride = 0;
  private labels = new Map<CabinEquipment, Phaser.GameObjects.Text>();

  reset(atPilot = false) {
    const start = atPilot ? cabinEquipment.pilot : cabinEquipment.hatch;
    this.x = start.x;
    this.y = start.y;
    this.facing = 1;
    this.stride = 0;
  }

  hide() {
    for (const label of this.labels.values()) label.setVisible(false);
  }

  walk(horizontal: number, vertical: number, dt: number) {
    const distance = (dt * 105) / Math.max(1, Math.hypot(horizontal, vertical));
    const x = Math.max(-185, Math.min(185, this.x + horizontal * distance));
    const y = Math.max(-37, Math.min(45, this.y + vertical * distance));
    if (horizontal) this.facing = horizontal;
    this.stride = x === this.x && y === this.y ? 0 : this.stride + dt * 16;
    this.x = x;
    this.y = y;
  }

  nearby() {
    let closest: CabinEquipment | undefined;
    let range = 25;
    for (const [id, item] of fixtures) {
      const distance = Math.hypot(this.x - item.x, this.y - item.y);
      if (distance <= range) {
        closest = id;
        range = distance;
      }
    }
    return closest;
  }

  draw(
    scene: Phaser.Scene,
    f: Phaser.GameObjects.Graphics,
    drawAstronaut: (x: number, y: number, walk: number, facing: number) => void,
  ) {
    const { width, height } = scene.scale;
    const project = (x: number, y: number, z = 0) => ({
      x: Math.round(width / 2 + x + y * 0.22),
      y: Math.round(height * 0.48 + y * 0.76 - z),
    });
    const rect = (color: number, x: number, y: number, w: number, h: number) =>
      f.fillStyle(color).fillRect(x, y, w, h);
    const polygon = (color: number, points: { x: number; y: number }[]) =>
      f.fillStyle(color).fillPoints(points, true);
    rect(0x0a1321, 0, 0, width, height);
    polygon(
      0x142637,
      hull.map(({ x, y }) => project(x, y, -12)),
    );
    polygon(
      0x476475,
      hull.map(({ x, y }) => project(x, y)),
    );
    polygon(
      0x253f52,
      hull.map(({ x, y }) => project(x * 0.97, y * 0.93)),
    );
    drawCabinDeck(f, project);
    const wall = hull.slice(0, 4);
    for (let i = 0; i < wall.length - 1; i++) {
      const a = wall[i]!,
        b = wall[i + 1]!;
      polygon(0x1e3548, [
        project(a.x, a.y),
        project(b.x, b.y),
        project(b.x, b.y, 43),
        project(a.x, a.y, 43),
      ]);
      polygon(0x547487, [
        project(a.x, a.y, 40),
        project(b.x, b.y, 40),
        project(b.x, b.y, 43),
        project(a.x, a.y, 43),
      ]);
    }
    drawCabinBulkhead(f, project);

    const selected = this.nearby();
    let drewPlayer = false;
    const drawPlayer = () => {
      const p = project(this.x, this.y);
      rect(0x152839, p.x - 6, p.y - 1, 12, 3);
      drawAstronaut(p.x, p.y - 12, Math.sin(this.stride) * 2, this.facing);
      drewPlayer = true;
    };
    for (const [id, item] of fixturesByDepth) {
      const back = item.y < 0;
      const depth = item.y + (id === "map" ? 0 : back ? -23 : 23);
      if (!drewPlayer && this.y < depth) drawPlayer();
      const { x, y } = project(item.x, depth);
      drawCabinFixture(f, id, x, y, item.color, selected === id);
      const label =
        this.labels.get(id) ??
        scene.add
          .text(0, 0, item.label, {
            fontFamily: "monospace",
            fontSize: "8px",
            backgroundColor: "#101e2d",
            padding: { x: 3, y: 2 },
          })
          .setOrigin(0.5);
      this.labels.set(id, label);
      label
        .setVisible(true)
        .setPosition(x, y + (id === "map" ? -42 : back ? -42 : 13))
        .setColor(id === selected ? "#a1f2db" : "#c2d5df");
    }
    if (!drewPlayer) drawPlayer();
  }
}
