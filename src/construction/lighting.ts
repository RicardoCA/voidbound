import type { BuildItem, PlacedPiece } from "../game/types";
export const FLOODLIGHT_RATE = 2;
export const EMERGENCY_RATE = 0.25;
export const EMERGENCY_CAPACITY = 120;
export const EMERGENCY_DRAIN = 0.1;
export function isBaseLight(kind: BuildItem | undefined) {
  return kind === "floodlight" || kind === "emergencyLight";
}
export function lightRate(kind: BuildItem) {
  return kind === "floodlight" ? FLOODLIGHT_RATE : EMERGENCY_RATE;
}
/** Standby charges the dedicated reserve; outages never borrow imaginary grid energy. */
export function advanceBaseLight(
  piece: PlacedPiece,
  supplied: number,
  elapsed: number,
) {
  const rate = lightRate(piece.kind);
  const suppliedTime = Math.min(elapsed, Math.max(0, supplied) / rate);
  piece.powered = suppliedTime >= elapsed - 1e-8;
  if (piece.kind === "emergencyLight") {
    const backup = piece.backupEnergy ?? 0;
    piece.backupEnergy = Math.max(
      0,
      Math.min(
        EMERGENCY_CAPACITY,
        backup + suppliedTime - (elapsed - suppliedTime) * EMERGENCY_DRAIN,
      ),
    );
    piece.emergencyActive = !piece.powered && piece.backupEnergy > 0;
  }
}
