import { clothing, type Outfit } from "./clothing";

export function astronautArt(outfit: Outfit | undefined, stride = 0) {
  const hat = outfit?.hat ? clothing[outfit.hat] : undefined;
  const visor = outfit?.visor ? clothing[outfit.visor] : undefined;
  const shirt = outfit?.shirt ? clothing[outfit.shirt] : undefined;
  const pants = outfit?.pants ? clothing[outfit.pants] : undefined;
  const pixels: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: number;
  }[] = [];
  const rect = (color: number, x: number, y: number, w: number, h: number) =>
    pixels.push({ color, x, y, w, h });
  const step = Math.round(stride);
  for (const [x, foot] of [
    [-5, 11 + step],
    [1, 11 - step],
  ] as const) {
    rect(0x101c2d, x, 4, 5, foot - 2);
    rect(pants?.color ?? 0x526979, x + 1, 5, 3, foot - 4);
    rect(pants?.trim ?? 0x7897a6, x + 1, 7, 2, 2);
    rect(0x283b4c, x, foot - 1, 6, 2);
    rect(0x607989, x + 2, foot - 1, 3, 1);
  }
  rect(0x122338, -8, -5, 5, 11);
  rect(0x597788, -8, -4, 3, 8);
  rect(0x8ed1c9, -7, -3, 1, 3);
  rect(0x132237, -5, -6, 12, 12);
  rect(shirt?.color ?? 0x9caeb0, -4, -5, 10, 9);
  rect(shirt?.trim ?? 0xc5dad2, -4, -5, 9, 2);
  rect(0x253c4d, 5, -3, 1, 7);
  rect(0x253848, -4, 4, 10, 2);
  rect(0xdbac74, 0, 4, 3, 1);
  rect(shirt?.color ?? 0x879ca6, 5, -4, 3, 6);
  rect(0xb9ccd1, 7, 0, 3, 3);
  if (shirt && "skull" in shirt) {
    rect(0xf1dfbe, -2, -2, 5, 3);
    rect(0xf1dfbe, -1, 1, 3, 2);
    rect(0x302b3c, -1, -1, 1, 1);
    rect(0x302b3c, 1, -1, 1, 1);
  } else {
    rect(shirt?.trim ?? 0x68b8b6, 1, -2, 3, 2);
  }
  rect(0x142537, -4, -15, 12, 10);
  rect(0xa4b6bd, -3, -15, 9, 9);
  rect(0xd4ddd2, -2, -15, 7, 1);
  rect(0x244353, 0, -13, 8, 6);
  rect(visor?.color ?? 0x429d9e, 1, -12, 6, 4);
  rect(visor?.trim ?? 0xadede1, 1, -12, 4, 1);
  rect(0x4a6476, -4, -10, 3, 3);
  if (hat) {
    rect(0x142537, -4, -21, 11, 6);
    rect(hat.color, -3, -21, 9, 5);
    rect(hat.trim, -2, -21, 7, 1);
    rect(hat.color, 4, -17, 7, 2);
    if ("skull" in hat) {
      rect(0xe9dac3, 0, -20, 3, 2);
      rect(0xe9dac3, 1, -18, 1, 1);
    }
  }
  return pixels;
}
