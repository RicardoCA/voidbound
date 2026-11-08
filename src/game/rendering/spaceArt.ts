import type Phaser from "phaser";
import { createNoise3D } from "simplex-noise";
import { hash, random } from "../procedural/random";
import type { Planet } from "../types";

const planetPalettes = [
  [0x544350, 0x9a6f66, 0xe2aa88, 0xd9a89a],
  [0x86513e, 0xcf8853, 0xffce84, 0xeaa665],
  [0x385b91, 0x81b2cb, 0xddeef2, 0xa6e9ff],
  [0x245368, 0x547c50, 0xa3ba72, 0x7edac0],
  [0x321f37, 0x783c4a, 0xc5724e, 0xffad69],
  [0x244875, 0x397fa0, 0x92b89b, 0x92e6ff],
] as const;
const size = 128;
const body = 54;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const channels = (color: number) => [
  (color >> 16) & 255,
  (color >> 8) & 255,
  color & 255,
];

function paintPlanet(context: CanvasRenderingContext2D, planet: Planet) {
  const noise = createNoise3D(random(planet.seed));
  const palette = (planetPalettes[planet.kind] ?? planetPalettes[0]).map(
    channels,
  );
  const rng = random(planet.seed + 371);
  const craters = Array.from({ length: 16 }, () => ({
    x: rng() * 1.8 - 0.9,
    y: rng() * 1.8 - 0.9,
    r: 0.045 + rng() * 0.15,
  }));
  const image = context.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - size / 2) / body,
        ny = (y + 0.5 - size / 2) / body;
      const radius = Math.hypot(nx, ny);
      if (radius > 1.16) continue;
      const index = (y * size + x) * 4;
      const sunward = clamp(0.48 - nx * 0.49 - ny * 0.46);
      if (radius > 1) {
        data.set(
          [
            ...palette[3]!,
            Math.round(112 * sunward * (1 - (radius - 1) / 0.16) ** 2),
          ],
          index,
        );
        continue;
      }
      const z = Math.sqrt(1 - radius * radius);
      const broad = noise(nx * 2.4, ny * 2.4, z * 2.4);
      const ridges = noise(nx * 8.6, ny * 8.6, z * 8.6);
      const fine = noise(nx * 24, ny * 24, z * 24);
      let terrain = 0.49 + broad * 0.28 + ridges * 0.19 + fine * 0.1;
      if (planet.kind === 0) {
        for (const crater of craters) {
          const d = Math.hypot(nx - crater.x, ny - crater.y) / crater.r;
          if (d < 1.22)
            terrain +=
              d > 0.79 ? 0.16 * (1 - Math.abs(d - 1)) : -0.23 * (1 - d * 0.5);
        }
      } else if (planet.kind === 1) {
        terrain += Math.sin(ny * 45 + broad * 4 + ridges) * 0.14;
      } else if (planet.kind === 2) {
        terrain += Math.abs(ny) * 0.22 - (Math.abs(ridges) < 0.065 ? 0.18 : 0);
      } else if (planet.kind === 4) {
        if (Math.abs(ridges + broad * 0.25) < 0.07) terrain = 1;
      } else {
        terrain = terrain < 0.52 ? terrain * 0.68 : terrain * 0.94 + 0.15;
      }
      const shade = Math.round(clamp(terrain) * 10) / 10;
      const low = palette[shade < 0.5 ? 0 : 1]!;
      const high = palette[shade < 0.5 ? 1 : 2]!;
      const t = (shade * 2) % 1 || (shade === 1 ? 1 : 0);
      const incidence = clamp(-nx * 0.58 - ny * 0.49 + z * 0.65);
      const light = 0.28 + (Math.round(incidence * 8) / 8) * 0.82;
      const cloud =
        planet.kind === 3 || planet.kind === 5
          ? clamp((noise(nx * 5, ny * 13, z * 6 + 7) - 0.34) * 1.2)
          : 0;
      const rim = Math.max(0, (radius - 0.92) * 12) * sunward * 0.5;
      for (let c = 0; c < 3; c++) {
        const material = low[c]! + (high[c]! - low[c]!) * t;
        data[index + c] =
          (material * (1 - cloud) + 231 * cloud) * light * (1 - rim) +
          palette[3]![c]! * rim;
      }
      data[index + 3] = 255;
    }
  context.putImageData(image, 0, 0);
}

export class PlanetTextures {
  private images = new Map<string, Phaser.GameObjects.Image>();

  hide() {
    for (const image of this.images.values()) image.setVisible(false);
  }

  clear(scene: Phaser.Scene) {
    for (const [id, image] of this.images) {
      image.destroy();
      scene.textures.remove("space-planet:" + id);
    }
    this.images.clear();
  }

  draw(
    scene: Phaser.Scene,
    planet: Planet,
    x: number,
    y: number,
    radius: number,
  ) {
    let image = this.images.get(planet.id);
    if (!image) {
      const texture = scene.textures.createCanvas(
        "space-planet:" + planet.id,
        size,
        size,
      );
      if (!texture) return;
      paintPlanet(texture.context, planet);
      texture.refresh();
      image = scene.add.image(x, y, texture).setDepth(-1);
      this.images.set(planet.id, image);
    }
    const diameter = (radius * size) / body;
    image.setPosition(x, y).setDisplaySize(diameter, diameter).setVisible(true);
  }
}

export function drawNebula(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  cameraX: number,
) {
  const shift = Math.sin(cameraX * 0.00018) * 32;
  for (let band = 0; band < 12; band++) {
    const center = Math.round(height * 0.26 + band * height * 0.04);
    const opacity = 0.055 + 0.035 * Math.sin((band * Math.PI) / 12);
    const edge = (x: number) =>
      Math.round(
        center + Math.sin((x + shift) / 110 + band * 0.12) * 28 + x * 0.11,
      );
    const points = [];
    for (let x = -24; x < width + 25; x += 24) points.push({ x, y: edge(x) });
    for (let x = points.at(-1)!.x; x >= -24; x -= 24)
      points.push({ x, y: edge(x) + 26 });
    g.fillStyle(band < 6 ? 0x334774 : 0x314d69, opacity).fillPoints(
      points,
      true,
    );
  }
}

const oreColors: Record<string, number> = {
  crystal: 0xbda0ff,
  copper: 0xe59b70,
  iron: 0xb2cad4,
  rawFuel: 0x7fe4bd,
  titanium: 0x8da7ed,
  silicon: 0xd7c69a,
};
const facetColors = [
  0xb78b77, 0x927777, 0x5c5269, 0x333950, 0x454359, 0x766176, 0x93716c,
  0xbc957e,
];
const outlineCache = new Map<number, { x: number; y: number }[]>();

export function drawAsteroid(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  id: string,
  ore: string,
) {
  const seed = hash(id) % 24;
  let shape = outlineCache.get(seed);
  if (!shape) {
    const rng = random(seed);
    shape = Array.from({ length: 8 }, (_, i) => {
      const angle = ((i - 3) * Math.PI) / 4;
      const length = 0.79 + rng() * 0.24;
      return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
    });
    outlineCache.set(seed, shape);
  }
  const ridgeX = x - radius * 0.18,
    ridgeY = y - radius * 0.16;
  for (const [i, point] of shape.entries()) {
    const next = shape[(i + 1) % shape.length]!;
    const px = Math.round(x + point.x * radius),
      py = Math.round(y + point.y * radius);
    const qx = Math.round(x + next.x * radius),
      qy = Math.round(y + next.y * radius);
    g.fillStyle(facetColors[i]!).fillTriangle(ridgeX, ridgeY, px, py, qx, qy);
    g.fillStyle(i < 3 || i > 6 ? 0xe6b38d : 0x1c2840, 0.38).fillTriangle(
      px,
      py,
      qx,
      qy,
      (px + qx + ridgeX) / 3,
      (py + qy + ridgeY) / 3,
    );
  }
  const vein = oreColors[ore] ?? 0x91b8bf;
  g.lineStyle(2, 0x242c40).lineBetween(
    x - radius * 0.45,
    y,
    x + 1,
    y + radius * 0.23,
  );
  g.lineStyle(1, vein, 0.8).lineBetween(
    x + 1,
    y + radius * 0.23,
    x + radius * 0.48,
    y - radius * 0.12,
  );
  g.fillStyle(vein)
    .fillRect(x + 1, y, 2, 2)
    .fillRect(x - radius * 0.36, y - radius * 0.35, 2, 1);
  g.fillStyle(0xf3e6d1, 0.8).fillRect(x + 2, y, 1, 1);
}

export function drawSpaceWreck(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
) {
  const rect = (color: number, dx: number, dy: number, w: number, h: number) =>
    g.fillStyle(color).fillRect(x + dx, y + dy, w, h);
  rect(0x384858, -18, -6, 12, 9);
  rect(0x7d929d, -17, -6, 10, 2);
  rect(0x182735, -14, -3, 8, 3);
  rect(0x6d8290, 8, 3, 10, 6);
  rect(0xa1886c, 12, 4, 4, 2);
  rect(0x292742, -6, -5, 13, 12);
  rect(0x8e70a1, -5, -6, 10, 10);
  rect(0xc5a3dc, -5, -6, 10, 2);
  rect(0x3c3056, -3, -3, 6, 5);
  rect(0xf0b578, -1, -2, 2, 1);
}
