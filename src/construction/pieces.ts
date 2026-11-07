import type { BuildItem, Settlement } from "../game/types";
export const keyAt = (x: number, y: number) => `${x},${y}`;
export function footprint(kind: BuildItem, x: number, y: number) {
  return kind === "woodDoor"
    ? [
        { x, y: y - 1 },
        { x, y },
      ]
    : [{ x, y }];
}
export function pieceAt(data: Settlement, x: number, y: number) {
  const key = keyAt(x, y),
    piece = data.pieces[key];
  if (piece) return { key, piece, x, y };
  const belowKey = keyAt(x, y + 1),
    below = data.pieces[belowKey];
  if (below?.kind === "woodDoor")
    return { key: belowKey, piece: below, x, y: y + 1 };
}
export function blocksAir(data: Settlement, x: number, y: number) {
  const piece = pieceAt(data, x, y)?.piece;
  return (
    piece?.kind === "woodBlock" || (piece?.kind === "woodDoor" && !piece.open)
  );
}
export function overlapsActor(
  kind: BuildItem,
  x: number,
  y: number,
  actor: { x: number; y: number },
) {
  const top = (kind === "woodDoor" ? y - 1 : y) * 16;
  return (
    actor.x + 5 > x * 16 &&
    actor.x - 5 < (x + 1) * 16 &&
    actor.y + 12 > top &&
    actor.y - 12 < (y + 1) * 16
  );
}
