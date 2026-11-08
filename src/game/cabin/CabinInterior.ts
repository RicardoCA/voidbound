import type Phaser from "phaser";

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
} as const;

export type CabinEquipment = keyof typeof cabinEquipment;
const fixtures = Object.entries(cabinEquipment) as [
  CabinEquipment,
  (typeof cabinEquipment)[CabinEquipment],
][];
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

  reset() {
    this.x = cabinEquipment.hatch.x;
    this.y = cabinEquipment.hatch.y;
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
    return fixtures.find(
      ([, item]) => Math.hypot(this.x - item.x, this.y - item.y) <= 25,
    )?.[0];
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
    for (let x = -175; x <= 175; x += 25) {
      f.lineStyle(1, 0x192f42).lineBetween(
        project(x, -41).x,
        project(x, -41).y,
        project(x, 44).x,
        project(x, 44).y,
      );
    }
    for (const y of [-43, -10, 16, 45]) {
      f.lineStyle(1, y === -10 || y === 16 ? 0x587984 : 0x182d3d).lineBetween(
        project(-188, y).x,
        project(-188, y).y,
        project(188, y).x,
        project(188, y).y,
      );
    }
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
    const window = project(54, -62, 30);
    rect(0x496775, window.x - 58, window.y - 1, 116, 23);
    rect(0x102738, window.x - 55, window.y + 2, 110, 17);
    rect(0x7fabb6, window.x - 31, window.y + 10, 2, 2);
    rect(0x638b99, window.x + 21, window.y + 7, 3, 1);

    const selected = this.nearby();
    let drewPlayer = false;
    const drawPlayer = () => {
      const p = project(this.x, this.y);
      rect(0x152839, p.x - 6, p.y - 1, 12, 3);
      drawAstronaut(p.x, p.y - 12, Math.sin(this.stride) * 2, this.facing);
      drewPlayer = true;
    };
    for (const [id, item] of fixtures) {
      const back = item.y < 0;
      const depth = item.y + (back ? -23 : 23);
      if (!drewPlayer && this.y < depth) drawPlayer();
      const { x, y } = project(item.x, depth);
      rect(0x152839, x - 23, y - 2, 46, 5);
      if (id === "hatch" || id === "inventory") {
        const h = id === "hatch" ? 34 : 24;
        rect(0x142736, x - 19, y - h, 39, h);
        rect(0x6b8690, x - 17, y - h, 32, h - 2);
        rect(
          id === "hatch" ? 0x294452 : 0x364d56,
          x - 14,
          y - h + 3,
          26,
          h - 6,
        );
        rect(item.color, x + 7, y - h + 10, 3, 7);
      } else {
        rect(0x162b3d, x - 19, y - 17, 38, 17);
        polygon(0x526f7f, [
          { x: x - 23, y: y - 19 },
          { x: x + 14, y: y - 19 },
          { x: x + 19, y: y - 14 },
          { x: x - 18, y: y - 14 },
        ]);
        rect(item.color, x - 17, y - 14, 34, 2);
        if (id === "pilot") {
          rect(0x132535, x - 6, y - 10, 12, 11);
          rect(item.color, x - 8, y - 8, 16, 4);
        } else {
          rect(0x233f50, x - 11, y - 11, 22, 7);
          rect(item.color, x - 7, y - 9, 14, 2);
        }
      }
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
        .setPosition(x, y + (back ? -42 : 13))
        .setColor(id === selected ? "#a1f2db" : "#c2d5df");
    }
    if (!drewPlayer) drawPlayer();
  }
}
