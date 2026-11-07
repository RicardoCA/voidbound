import type { Settlement } from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { blocksAir, keyAt, pieceAt } from "./pieces";
export const ENERGY_CAP = 100,
  OXYGEN_CAP = 100,
  SOLAR_RATE = 8,
  GENERATOR_RATE = 6,
  REFILL_RATE = 8,
  POWER_RANGE = 12;
export const daylight = (time: number) => Math.max(0, Math.cos(time / 150));
function solarPrimitive(angle: number) {
  const cycle = 2 * Math.PI,
    cycles = Math.floor(angle / cycle),
    r = angle - cycles * cycle;
  return (
    cycles * 2 +
    (r <= Math.PI / 2 ? Math.sin(r) : r <= Math.PI * 1.5 ? 1 : 2 + Math.sin(r))
  );
}
export function sunlightBetween(from: number, to: number) {
  if (to <= from) return 0;
  return Math.max(
    0,
    Math.min(
      to - from,
      150 * (solarPrimitive(to / 150) - solarPrimitive(from / 150)),
    ),
  );
}
export function exposedToSky(
  terrain: Terrain,
  data: Settlement,
  x: number,
  y: number,
) {
  for (let row = y - 1; row >= 0; row--)
    if (
      terrain.get(x, row) !== 0 ||
      blocksAir(data, x, row) ||
      pieceAt(data, x, row)?.piece.kind === "solarPanel"
    )
      return false;
  return true;
}
export type RoomReason =
  "sealed" | "open" | "door" | "walls" | "large" | "blocked";
export interface Room {
  sealed: boolean;
  reason: RoomReason;
  cells: Set<string>;
}
export function analyzeRoom(
  terrain: Terrain,
  data: Settlement,
  x: number,
  y: number,
  limit = 1024,
): Room {
  const cells = new Set<string>(),
    queue = [{ x, y }],
    queued = new Set([keyAt(x, y)]);
  let sawOpenDoor = false;
  const fail = (reason: RoomReason): Room => ({ sealed: false, reason, cells });
  if (terrain.get(x, y) !== 0 || blocksAir(data, x, y)) return fail("blocked");
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!,
      key = keyAt(at.x, at.y);
    if (at.y < 0 || at.y >= 63) return fail("open");
    if (terrain.get(at.x, at.y) !== 0 || blocksAir(data, at.x, at.y)) continue;
    const piece = pieceAt(data, at.x, at.y)?.piece;
    if (piece?.kind === "woodDoor" && piece.open) sawOpenDoor = true;
    if (!data.walls[key])
      return fail(
        sawOpenDoor
          ? "door"
          : exposedToSky(terrain, data, at.x, at.y)
            ? "open"
            : "walls",
      );
    cells.add(key);
    if (cells.size > limit) return fail("large");
    for (const next of [
      { x: at.x - 1, y: at.y },
      { x: at.x + 1, y: at.y },
      { x: at.x, y: at.y - 1 },
      { x: at.x, y: at.y + 1 },
    ]) {
      const id = keyAt(next.x, next.y);
      if (!queued.has(id)) {
        queued.add(id);
        queue.push(next);
      }
    }
  }
  return { sealed: true, reason: "sealed", cells };
}
export interface PowerNetwork {
  generators: {
    key: string;
    x: number;
    y: number;
    panels: number;
    room: Room;
  }[];
  panels: number;
  exposedPanels: number;
}
/** One panel powers at most one generator: the nearest within twelve tiles. */
export function powerNetwork(terrain: Terrain, data: Settlement): PowerNetwork {
  const generators = Object.entries(data.pieces)
    .filter(([, p]) => p.kind === "oxygenGenerator")
    .map(([key]) => {
      const [x, y] = key.split(",").map(Number);
      return {
        key,
        x: x!,
        y: y!,
        panels: 0,
        room: analyzeRoom(terrain, data, x!, y!),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const panels = Object.entries(data.pieces).filter(
    ([, p]) => p.kind === "solarPanel",
  );
  let exposedPanels = 0;
  for (const [key] of panels) {
    const [x, y] = key.split(",").map(Number);
    if (!exposedToSky(terrain, data, x!, y!)) continue;
    exposedPanels++;
    let nearest: (typeof generators)[number] | undefined,
      distance = POWER_RANGE + 0.00001;
    for (const generator of generators) {
      const d = Math.hypot(generator.x - x!, generator.y - y!);
      if (d < distance) {
        distance = d;
        nearest = generator;
      }
    }
    if (nearest) nearest.panels++;
  }
  return { generators, panels: panels.length, exposedPanels };
}
export function advanceGenerator(
  piece: { energy?: number; oxygen?: number },
  panels: number,
  from: number,
  to: number,
) {
  const elapsed = Math.max(0, to - from),
    available =
      Math.max(0, Math.min(ENERGY_CAP, piece.energy ?? 0)) +
      panels * SOLAR_RATE * sunlightBetween(from, to);
  const stored = Math.max(0, Math.min(OXYGEN_CAP, piece.oxygen ?? 0)),
    produced = Math.min(
      OXYGEN_CAP - stored,
      GENERATOR_RATE * elapsed,
      available * 3,
    );
  piece.energy = Math.min(ENERGY_CAP, Math.max(0, available - produced / 3));
  piece.oxygen = Math.min(OXYGEN_CAP, stored + produced);
}
export interface HabitatReport {
  supplied: boolean;
  sealed: boolean;
  hasGenerator: boolean;
  reason: RoomReason | "no-generator" | "no-power" | "outside";
  panels: number;
  exposedPanels: number;
  connectedPanels: number;
  generators: number;
  energy: number;
  oxygen: number;
  gain: number;
}
export const emptyHabitat = (): HabitatReport => ({
  supplied: false,
  sealed: false,
  hasGenerator: false,
  reason: "open",
  panels: 0,
  exposedPanels: 0,
  connectedPanels: 0,
  generators: 0,
  energy: 0,
  oxygen: 0,
  gain: 0,
});
export function habitatMessage(report: HabitatReport) {
  if (report.supplied)
    return report.gain > 0
      ? "Casa pressurizada · O₂ recarregando"
      : "Casa pressurizada · Oxigênio estável";
  if (report.reason === "outside")
    return "Entre na casa pressurizada para recarregar";
  if (report.reason === "no-power")
    return "Gerador sem reservas · Verifique as placas solares";
  if (report.reason === "no-generator")
    return "Cômodo fechado · Instale um gerador de oxigênio";
  if (report.reason === "door") return "Porta aberta · Feche para pressurizar";
  if (report.reason === "walls")
    return "Vedação incompleta · Preencha as paredes de fundo";
  if (report.reason === "large")
    return "Cômodo grande demais · Divida em salas menores";
  return "Ambiente aberto · Feche piso, teto e laterais";
}
