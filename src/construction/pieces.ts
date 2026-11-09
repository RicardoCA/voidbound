import type { BuildItem, Settlement } from "../game/types";
export const keyAt = (x: number, y: number) => `${x},${y}`;
export const cabinetWidths = {
  cabinet: 1,
  fridge: 1,
  cabinetDouble: 2,
  cabinetTriple: 3,
} as const;
export type CabinetKind = keyof typeof cabinetWidths;
export function isCabinet(kind: BuildItem | undefined): kind is CabinetKind {
  return kind !== undefined && Object.hasOwn(cabinetWidths, kind);
}
export function footprint(kind: BuildItem, x: number, y: number) {
  return kind === "woodDoor"
    ? [
        { x, y: y - 1 },
        { x, y },
      ]
    : Array.from(
        { length: isCabinet(kind) ? cabinetWidths[kind] : 1 },
        (_, offset) => ({ x: x + offset, y }),
      );
}
export function pieceAt(data: Settlement, x: number, y: number) {
  const key = keyAt(x, y),
    piece = data.pieces[key];
  if (piece) return { key, piece, x, y };
  for (let offset = 1; offset < cabinetWidths.cabinetTriple; offset++) {
    const anchor = x - offset;
    const cabinetKey = keyAt(anchor, y);
    const cabinet = data.pieces[cabinetKey];
    if (
      cabinet &&
      isCabinet(cabinet.kind) &&
      cabinetWidths[cabinet.kind] > offset
    )
      return { key: cabinetKey, piece: cabinet, x: anchor, y };
  }
  const belowKey = keyAt(x, y + 1),
    below = data.pieces[belowKey];
  if (below?.kind === "woodDoor")
    return { key: belowKey, piece: below, x, y: y + 1 };
}
export function isWall(
  kind: BuildItem,
): kind is "woodWall" | "stoneWall" | "metalWall" {
  return kind === "woodWall" || kind === "stoneWall" || kind === "metalWall";
}
export function isOpening(kind: BuildItem | undefined) {
  return kind === "woodDoor" || kind === "woodHatch";
}
export function blocksAir(data: Settlement, x: number, y: number) {
  const piece = pieceAt(data, x, y)?.piece;
  return (
    piece?.kind === "woodBlock" ||
    (piece !== undefined && isOpening(piece.kind) && !piece.open)
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
