export const landingZones = [
  { id: 0, tileX: 0, name: "Planície de Aurora" },
  { id: 1, tileX: 24, name: "Dorsal do Horizonte" },
  { id: 2, tileX: 48, name: "Bacia Silenciosa" },
] as const;
export function nearestLanding(x: number) {
  return landingZones.reduce(
    (best, zone) =>
      Math.abs(x - zone.tileX) < Math.abs(x - best.tileX) ? zone : best,
    landingZones[0] as (typeof landingZones)[number],
  );
}
