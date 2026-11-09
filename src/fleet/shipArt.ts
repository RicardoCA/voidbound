import { hash } from "../game/procedural/random";
import type { ShipModelId } from "../game/types";
import { shipModels, shipPalette } from "./models";

interface Plate {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

const cache = new Map<ShipModelId, { hull: Plate[]; details: Plate[] }>();
const liveries = [0xdbad67, 0x85cbbf, 0xa3a9e6, 0xdb8c7f, 0x7eaadc, 0xb2cb8f];

function shade(color: number, factor: number) {
  const component = (shift: number) =>
    Math.min(255, Math.round(((color >> shift) & 255) * factor));
  return (component(16) << 16) | (component(8) << 8) | component(0);
}

export function shipArt(id: ShipModelId) {
  const existing = cache.get(id);
  if (existing) return existing;
  const model = shipModels[id];
  const seed = hash(id);
  const accent =
    id === "sparrow"
      ? 0xd8ae70
      : model.category === "combat"
        ? [0xd78276, 0xd89172, 0xbda3dd][seed % 3]!
        : liveries[seed % liveries.length]!;
  const hull: Plate[] = [];
  const details: Plate[] = [];
  const plate = (x: number, y: number, w: number, h: number, color: number) =>
    details.push({ x, y, w, h, color });
  for (const [rowIndex, row] of model.sprite.entries()) {
    for (let start = 0; start < row.length;) {
      const pixel = row[start]!;
      let end = start + 1;
      while (row[end] === pixel) end++;
      if (pixel !== ".") {
        const base =
          pixel === "a" || pixel === "r"
            ? accent
            : shipPalette[pixel as keyof typeof shipPalette];
        const color = shade(
          base,
          rowIndex < 5 ? 1.12 : rowIndex > 5 ? 0.72 : 0.94,
        );
        hull.push({
          x: start * 3,
          y: rowIndex * 3,
          w: (end - start) * 3,
          h: 3,
          color,
        });
      }
      start = end;
    }
    for (const [column, pixel] of [...row].entries()) {
      if (pixel === ".") continue;
      const x = column * 3,
        y = rowIndex * 3;
      const above = model.sprite[rowIndex - 1]?.[column] ?? ".";
      const below = model.sprite[rowIndex + 1]?.[column] ?? ".";
      const base =
        pixel === "a" || pixel === "r"
          ? accent
          : shipPalette[pixel as keyof typeof shipPalette];
      if (pixel === "c") {
        if (above !== "c") plate(x, y, 3, 1, 0x223e52);
        plate(x, y + 1, 3, 1, rowIndex < 6 ? 0xb2f4df : 0x428e9e);
        if (below !== "c") plate(x, y + 2, 3, 1, 0x23465b);
      } else if (pixel === "e") {
        plate(x, y + 1, 2, 1, 0xe0fff0);
        if (rowIndex > 5) plate(x + 2, y, 1, 3, 0x3b8d98);
      } else {
        if (above === ".") plate(x, y, 3, 1, shade(base, 1.38));
        if (below === ".") plate(x, y + 2, 3, 1, 0x192d43);
        if ((column + (seed % 4)) % 4 === 0 && above !== ".")
          plate(x, y, 1, 3, shade(base, 0.5));
        if (pixel === "s" && (rowIndex + column) % 4 === 0)
          plate(x + 1, y + 1, 2, 1, accent);
        if (pixel === "b" && rowIndex === 5 && column % 3 === 1)
          plate(x + 1, y + 1, 2, 1, 0x425e73);
      }
    }
  }
  const art = { hull, details };
  cache.set(id, art);
  return art;
}
