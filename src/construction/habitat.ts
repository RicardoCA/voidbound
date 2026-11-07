import type { Settlement } from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { blocksAir, keyAt, pieceAt } from "./pieces";
export const BATTERY_CAP = 1200;
export const OXYGEN_CAP = 100,
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
    batteries: string[];
    room: Room;
  }[];
  batteries: { key: string; x: number; y: number; panels: number }[];
  panels: number;
  exposedPanels: number;
}
/** Panels prefer the nearest battery; batteries feed one nearby generator. */
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
        batteries: [] as string[],
        room: analyzeRoom(terrain, data, x!, y!),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const batteries = Object.entries(data.pieces)
    .filter(([, p]) => p.kind === "battery")
    .map(([key]) => {
      const [x, y] = key.split(",").map(Number);
      return { key, x: x!, y: y!, panels: 0 };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  function nearest<T extends { x: number; y: number }>(
    nodes: T[],
    x: number,
    y: number,
  ) {
    let result: T | undefined,
      distance = POWER_RANGE + 0.00001;
    for (const node of nodes) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < distance) {
        distance = d;
        result = node;
      }
    }
    return result;
  }
  for (const battery of batteries)
    nearest(generators, battery.x, battery.y)?.batteries.push(battery.key);
  const panels = Object.entries(data.pieces).filter(
    ([, p]) => p.kind === "solarPanel",
  );
  let exposedPanels = 0;
  for (const [key] of panels) {
    const [x, y] = key.split(",").map(Number);
    if (!exposedToSky(terrain, data, x!, y!)) continue;
    exposedPanels++;
    const target =
      nearest(batteries, x!, y!) ??
      nearest(
        generators.filter((g) => !g.batteries.length),
        x!,
        y!,
      );
    if (target) target.panels++;
  }
  return { generators, batteries, panels: panels.length, exposedPanels };
}
/** Each battery and panel has a single consumer, so power is never duplicated. */
export function advancePowerNetwork(
  data: Settlement,
  network: PowerNetwork,
  from: number,
  to: number,
) {
  const sun = sunlightBetween(from, to),
    elapsed = Math.max(0, to - from);
  for (const generator of network.generators)
    data.pieces[generator.key]!.energy = 0;
  if (!elapsed) return;
  for (const battery of network.batteries) {
    const piece = data.pieces[battery.key]!;
    piece.energy = Math.min(
      BATTERY_CAP,
      Math.max(0, piece.energy ?? 0) + battery.panels * SOLAR_RATE * sun,
    );
  }
  for (const generator of network.generators) {
    const piece = data.pieces[generator.key]!;
    if (!generator.batteries.length) {
      advanceGenerator(piece, generator.panels, from, to);
      continue;
    }
    let needed = Math.max(
      0,
      Math.min(OXYGEN_CAP - (piece.oxygen ?? 0), GENERATOR_RATE * elapsed) / 3,
    );
    let suppliedEnergy = 0;
    for (const key of generator.batteries) {
      const battery = data.pieces[key]!,
        supplied = Math.min(needed, battery.energy ?? 0);
      battery.energy = Math.max(0, (battery.energy ?? 0) - supplied);
      suppliedEnergy += supplied;
      needed -= supplied;
    }
    advanceGenerator(piece, 0, from, to, suppliedEnergy);
  }
}

export function advanceGenerator(
  piece: { energy?: number; oxygen?: number },
  panels: number,
  from: number,
  to: number,
  suppliedEnergy = 0,
) {
  const elapsed = Math.max(0, to - from),
    available =
      Math.max(0, suppliedEnergy) +
      panels * SOLAR_RATE * sunlightBetween(from, to);
  const stored = Math.max(0, Math.min(OXYGEN_CAP, piece.oxygen ?? 0)),
    produced = Math.min(
      OXYGEN_CAP - stored,
      GENERATOR_RATE * elapsed,
      available * 3,
    );
  // Electricity is stored only in placed batteries, never inside the generator.
  piece.energy = 0;
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
  batteries: number;
  batteryEnergy: number;
  batteryCapacity: number;
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
  batteries: 0,
  batteryEnergy: 0,
  batteryCapacity: 0,
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
    return "Gerador sem reservas · Verifique as placas solares e baterias";
  if (report.reason === "no-generator")
    return "Cômodo fechado · Instale um gerador de oxigênio";
  if (report.reason === "door") return "Porta aberta · Feche para pressurizar";
  if (report.reason === "walls")
    return "Vedação incompleta · Preencha as paredes de fundo";
  if (report.reason === "large")
    return "Cômodo grande demais · Divida em salas menores";
  return "Ambiente aberto · Feche piso, teto e laterais";
}
