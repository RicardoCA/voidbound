import { isFacility } from "./facilityTypes";
import type { BuildItem, PlacedPiece, Settlement } from "../game/types";
export const keyAt = (x: number, y: number, depth = 0) => depth ? `${x},${y},${depth}` : `${x},${y}`;
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
export function isDoor(kind: BuildItem | undefined) {
  return kind === "woodDoor" || kind === "airlockDoor";
}
export function pieceWidth(kind: BuildItem) {
  return isFacility(kind) || kind === "workbench" ? 2 : isCabinet(kind) ? cabinetWidths[kind] : 1;
}
export function footprint(kind: BuildItem, x: number, y: number) {
  if (isFacility(kind)) return [0, 1].flatMap(offset => [{ x: x + offset, y }, { x: x + offset, y: y - 1 }]);
  return isDoor(kind)
    ? [
        { x, y: y - 1 },
        { x, y },
      ]
    : Array.from(
        { length: pieceWidth(kind) },
        (_, offset) => ({ x: x + offset, y }),
      );
}
export function pieceAt(data: Settlement, x: number, y: number, depth = 0) {
  const key = keyAt(x, y, depth),
    piece = data.pieces[key];
  if (piece) return { key, piece, x, y };
  for (let offset = 1; offset < cabinetWidths.cabinetTriple; offset++) {
    const anchor = x - offset;
    const cabinetKey = keyAt(anchor, y, depth);
    const cabinet = data.pieces[cabinetKey];
    if (
      cabinet &&
      pieceWidth(cabinet.kind) > offset
    )
      return { key: cabinetKey, piece: cabinet, x: anchor, y };
  }
  for (let offset = 0; offset < 2; offset++) {
    const anchor = keyAt(x - offset, y + 1, depth), piece = data.pieces[anchor];
    if (piece && isFacility(piece.kind)) return { key: anchor, piece, x: x - offset, y: y + 1 };
  }
  const belowKey = keyAt(x, y + 1, depth),
    below = data.pieces[belowKey];
  if (below && isDoor(below.kind))
    return { key: belowKey, piece: below, x, y: y + 1 };
}
export function isWall(
  kind: BuildItem,
): kind is "woodWall" | "stoneWall" | "metalWall" {
  return kind === "woodWall" || kind === "stoneWall" || kind === "metalWall";
}
export function isOpening(kind: BuildItem | undefined) {
  return isDoor(kind) || kind === "woodHatch" || kind === "fenceGate";
}
export function isFence(kind: BuildItem | undefined) {
  return kind === "woodFence" || kind === "fenceGate";
}
export function blocksFence(piece: PlacedPiece | undefined) {
  return piece?.kind === "woodFence" || (piece?.kind === "fenceGate" && !piece.open);
}
export function blocksAir(data: Settlement, x: number, y: number, depth = 0) {
  const piece = pieceAt(data, x, y, depth)?.piece;
  return (
    piece?.kind === "woodBlock" ||
    piece?.kind === "cropRoof" ||
    piece?.kind === "window" ||
    (piece !== undefined && piece.kind !== "fenceGate" && isOpening(piece.kind) && !piece.open)
  );
}
export function overlapsActor(
  kind: BuildItem,
  x: number,
  y: number,
  actor: { x: number; y: number },
) {
  const top = (isDoor(kind) || isFacility(kind) ? y - 1 : y) * 16;
  return (
    actor.x + 5 > x * 16 &&
    actor.x - 5 < (x + pieceWidth(kind)) * 16 &&
    actor.y + 12 > top &&
    actor.y - 12 < (y + 1) * 16
  );
}
