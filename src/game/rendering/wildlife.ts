import type Phaser from "phaser";
import type { Animal, Fruit } from "../../survival/wildlife";

export function drawFruit(
  g: Phaser.GameObjects.Graphics,
  fruit: Fruit,
  x: number,
  y: number,
) {
  g.fillStyle(0x4d765e);
  g.fillRect(x - 9, y + 2, 18, 5);
  g.fillRect(x - 6, y - 3, 12, 6);
  g.fillStyle(fruit.color);
  g.fillRect(x - 7, y - 3, 4, 4);
  g.fillRect(x, y - 5, 4, 4);
  g.fillRect(x + 4, y + 1, 4, 4);
}

export function drawAnimal(
  g: Phaser.GameObjects.Graphics,
  animal: Animal,
  x: number,
  y: number,
) {
  const dir = animal.facing;
  const length = animal.hostile ? 26 : 19;
  g.fillStyle(animal.hide);
  g.fillRect(x - length / 2, y - 6, length, 12);
  g.fillRect(x + dir * (length / 2) - 4, y - 9, 8, 10);
  g.fillRect(x - 7, y + 5, 3, 7);
  g.fillRect(x + 5, y + 5, 3, 7);
  g.fillStyle(animal.crest);
  g.fillRect(x - 7, y - 8, 14, 3);
  if (animal.kind === 0 || animal.kind === 4) {
    g.fillRect(x - dir * (length / 2 + 4) - 4, y, 8, 3);
  } else if (animal.kind === 2 || animal.kind === 3) {
    g.fillRect(x + dir * (length / 2) - 3, y - 13, 2, 5);
    g.fillRect(x + dir * (length / 2) + 1, y - 13, 2, 5);
  } else {
    g.fillRect(x - dir * (length / 2 + 3) - 2, y - 4, 4, 5);
  }
  g.fillStyle(animal.hostile ? 0xff654d : 0x273845);
  g.fillRect(x + dir * (length / 2 + 1) - 1, y - 6, 2, 2);
  if (animal.health < animal.maxHealth) {
    g.fillStyle(0x233442);
    g.fillRect(x - 10, y - 17, 20, 2);
    g.fillStyle(0xf19b82);
    g.fillRect(x - 10, y - 17, (20 * animal.health) / animal.maxHealth, 2);
  }
}
