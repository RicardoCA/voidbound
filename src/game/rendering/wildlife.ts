import type Phaser from "phaser";
import type { Animal, Fruit } from "../../survival/wildlife";

const fruitPlants = {
  basaltBerry: { stem: 0x526b66, leaf: 0x8da899, shape: [3, 3] },
  amberFig: { stem: 0x80603d, leaf: 0xb2a267, shape: [3, 5] },
  frostPlum: { stem: 0x416478, leaf: 0xb1dbe2, shape: [4, 4] },
  jadePear: { stem: 0x3e633d, leaf: 0x86b870, shape: [4, 5] },
  emberFruit: { stem: 0x613b48, leaf: 0xa9655c, shape: [4, 4] },
  tideMelon: { stem: 0x385e62, leaf: 0x77aba6, shape: [5, 3] },
};

export function drawFruit(
  g: Phaser.GameObjects.Graphics,
  fruit: Fruit,
  x: number,
  y: number,
) {
  const plant = fruitPlants[fruit.item as keyof typeof fruitPlants];
  if (!plant) return;
  const [width, height] = plant.shape;
  g.fillStyle(0x172835, 0.3).fillEllipse(x + 1, y + 7, 22, 4);
  g.fillStyle(plant.stem).fillRect(x - 1, y - 3, 2, 11);
  g.fillStyle(plant.leaf)
    .fillRect(x - 9, y + 3, 9, 3)
    .fillRect(x + 1, y, 8, 3);
  g.fillRect(x - 5, y - 3, 4, 3).fillRect(x + 3, y - 5, 3, 2);
  for (const [dx, dy] of [
    [-7, 0],
    [-1, -5],
    [5, 2],
  ]) {
    g.fillStyle(0x263444).fillRect(x + dx - 1, y + dy + 1, width + 1, height);
    g.fillStyle(fruit.color).fillRect(x + dx, y + dy, width, height);
    g.fillStyle(0xfff3d2, 0.64).fillRect(x + dx, y + dy, 2, 1);
  }
}

// Body length, height, leg length and head height for each peaceful/hostile pair.
const fauna = [
  [
    [19, 7, 4, 5],
    [26, 10, 5, 7],
  ], // Basalt lizard / obsidian crawler
  [
    [15, 9, 6, 7],
    [23, 9, 8, 7],
  ], // Amber hare / dune jackal
  [
    [17, 10, 7, 7],
    [25, 13, 5, 9],
  ], // Glacial lemur / frost bear
  [
    [19, 9, 10, 7],
    [24, 9, 7, 7],
  ], // Jade deer / canopy cat
  [
    [20, 10, 4, 5],
    [25, 8, 4, 6],
  ], // Ash armadillo / ember salamander
  [
    [18, 8, 5, 5],
    [27, 6, 0, 8],
  ], // Tide crab / mangrove viper
] as const;

export function drawAnimal(
  g: Phaser.GameObjects.Graphics,
  animal: Animal,
  x: number,
  y: number,
  time: number,
) {
  const [length, height, legs, head] =
    fauna[animal.kind]![Number(animal.hostile)]!;
  const rear = -Math.floor(length / 2);
  const front = rear + length;
  const belly = 12 - legs;
  const back = belly - height;
  const headY = back - 2;
  const shade = 0x273342;
  const stride = animal.grounded
    ? Math.round(Math.sin(time * 12 + animal.home) * 2)
    : 1;
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
      .fillRect(x + (animal.facing < 0 ? -dx - w : dx), y + dy, w, h);

  if (legs) {
    rect(shade, rear + 3, belly - 2, 3, legs + 2);
    rect(shade, front - 5, belly - 2, 3, legs + 2);
    rect(animal.hide, rear + 2 + stride, belly - 1, 3, legs + 1);
    rect(animal.hide, front - 4 - stride, belly - 1, 3, legs + 1);
  }
  rect(shade, rear - 1, back + 1, length + 2, height);
  rect(animal.hide, rear, back + 2, length, height - 2);
  rect(animal.hide, rear + 3, back, length - 6, 3);
  rect(animal.crest, rear + 3, back, length - 7, 2);
  rect(shade, rear + 2, belly - 2, length - 3, 2, 0.38);
  rect(animal.hide, front - 4, headY, 8, head);
  rect(animal.crest, front - 3, headY, 5, 1);

  switch (animal.kind) {
    case 0:
      rect(animal.hide, rear - 8, belly - 3, 10, 3);
      for (let dx = rear + 3; dx < front - 4; dx += 4)
        rect(animal.crest, dx, back - (animal.hostile ? 2 : 0), 2, 3);
      break;
    case 1:
      rect(animal.crest, front - 3, headY - 5, 2, 6);
      rect(
        animal.hide,
        front + 1,
        headY - (animal.hostile ? 4 : 8),
        2,
        animal.hostile ? 5 : 9,
      );
      rect(
        animal.crest,
        rear - (animal.hostile ? 6 : 3),
        back + 2,
        animal.hostile ? 7 : 4,
        3,
      );
      break;
    case 2:
      if (animal.hostile) {
        rect(animal.crest, front - 3, headY - 2, 3, 3);
        rect(animal.crest, front + 2, headY - 2, 3, 3);
      } else {
        rect(animal.hide, rear - 7, back - 4, 3, 9);
        rect(animal.crest, rear - 9, back - 6, 4, 3);
        rect(shade, rear - 7, back - 1, 3, 2);
      }
      break;
    case 3:
      if (animal.hostile) {
        rect(animal.hide, rear - 9, back + 2, 11, 2);
        rect(animal.crest, rear - 9, back, 3, 3);
        for (let dx = rear + 4; dx < front - 4; dx += 4)
          rect(shade, dx, back + 3, 2, 2, 0.65);
      } else {
        rect(animal.crest, front - 2, headY - 7, 1, 8);
        rect(animal.crest, front - 5, headY - 8, 4, 2);
        rect(animal.crest, front + 1, headY - 5, 3, 2);
      }
      break;
    case 4:
      for (let dx = rear + 3; dx < front - 2; dx += 4)
        rect(
          animal.crest,
          dx,
          back + (animal.hostile ? 0 : -1),
          2,
          animal.hostile ? 3 : 6,
        );
      rect(animal.hide, rear - 6, belly - 4, 8, 3);
      break;
    default:
      if (animal.hostile) {
        rect(animal.crest, rear - 7, belly - 3, 9, 2);
        rect(animal.crest, front + 3, headY + 4, 3, 1);
      } else {
        rect(animal.crest, front + 2, back - 4, 5, 4);
        rect(animal.hide, front + 5, back - 6, 2, 4);
        rect(animal.crest, rear - 3, back - 2, 5, 3);
      }
  }
  rect(animal.hostile ? 0xff7059 : 0x172634, front + 1, headY + 2, 2, 2);
  if (animal.health < animal.maxHealth) {
    g.fillStyle(shade).fillRect(x - 10, y - 20, 20, 2);
    g.fillStyle(0xf19b82).fillRect(
      x - 10,
      y - 20,
      (20 * animal.health) / animal.maxHealth,
      2,
    );
  }
}
