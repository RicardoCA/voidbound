import { facilityDefinitions, isFacility, emptyFacility } from "./facilityTypes";
import { weatherAt } from "../game/procedural/weather";
import { isBaseLight, lightRate, advanceBaseLight } from "./lighting";
import type { Settlement } from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { blocksAir, isOpening, isDoor, keyAt, pieceAt } from "./pieces";
export const BATTERY_CAP = 1200;
export const OXYGEN_CAP = 100,
  SOLAR_RATE = 8,
  GENERATOR_RATE = 6,
  REFILL_RATE = 8,
  FRIDGE_RATE = 1;
export const POWER_RANGE = 12;
const SOLAR_TIME_SCALE = 150;
export const PLANET_DAY = 2 * Math.PI * SOLAR_TIME_SCALE;
export const solarPhase = (time: number) => time / SOLAR_TIME_SCALE;
export const daylight = (time: number) =>
  Math.max(0, Math.cos(solarPhase(time)));
export function planetClock(time: number) {
  const minutesPerDay = 24 * 60;
  const minutes = Math.floor(
    ((solarPhase(time) / (2 * Math.PI) + 0.5) % 1) * minutesPerDay,
  );
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
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
      SOLAR_TIME_SCALE *
        (solarPrimitive(solarPhase(to)) - solarPrimitive(solarPhase(from))),
    ),
  );
}
export function exposedToSky(
  terrain: Terrain,
  data: Settlement,
  x: number,
  y: number,
  depth = 0,
) {
  for (let row = y - 1; row >= 0; row--)
    if (
      terrain.getAt(x, row, depth) !== 0 ||
      (blocksAir(data, x, row, depth) || data.depthBlocks?.[keyAt(x, row, depth)]) ||
      pieceAt(data, x, row, depth)?.piece.kind === "solarPanel"
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
    if (piece?.open && piece.kind !== "fenceGate" && isOpening(piece.kind)) sawOpenDoor = true;
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
// A rotated panel seals one horizontal face of its construction cell.
const roomDirections = [
  [0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0],
  [0, -1, 0], [0, 1, 0],
] as const;

export function analyzeSpatialRoom(terrain: Terrain, data: Settlement, x: number, y: number, depth: number): Room {
  const cells = new Set([keyAt(x, y, depth)]);
  const queue = [{ x, y, depth }];
  const closedFace = (x: number, y: number, depth: number, face: number) => {
    const key = keyAt(x, y, depth);
    const wall = (depth ? data.depthWalls : data.walls)?.[key];
    const door = pieceAt(data, x, y, depth)?.piece;
    return (wall && (data.wallRotations?.[key] ?? 0) === face) ||
      data.cornerWalls?.[key]?.[face] ||
      ((door?.kind === "window" || (door && isDoor(door.kind) && !door.open)) && (door.rotation ?? 0) === face);
  };
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    if (at.y < 0 || at.y >= 63) return { sealed: false, reason: "open", cells: new Set() };
    for (const [face, [dx, dy, dz]] of roomDirections.entries()) {
      const next = { x: at.x + dx, y: at.y + dy, depth: at.depth + dz };
      const key = keyAt(next.x, next.y, next.depth);
      if (cells.has(key) || terrain.getAt(next.x, next.y, next.depth) || data.depthBlocks?.[key]) continue;
      const piece = pieceAt(data, next.x, next.y, next.depth)?.piece;
      if (piece?.kind === "woodBlock" || piece?.kind === "cropRoof" || (piece?.kind === "woodHatch" && !piece.open)) continue;
      if (face < 4 && (closedFace(at.x, at.y, at.depth, face) ||
          closedFace(next.x, next.y, next.depth, (face + 2) % 4))) continue;
      cells.add(key);
      if (cells.size > 1024) return { sealed: false, reason: "large", cells: new Set() };
      queue.push(next);
    }
  }
  return { sealed: true, reason: "sealed", cells };
}

export function hasPlanetaryOxygenGenerator(data?: Settlement) {
  return Object.values(data?.pieces ?? {}).some((piece) => piece.kind === "planetaryOxygenGenerator");
}

export interface PowerNetwork {
  elevatorPanels: { x: number; y: number; depth: number }[];
  facilities: { key: string; exposed: boolean; batteries: string[]; panels: string[] }[];
  facilityPlanet?: import("../game/types").Planet;
  planetary: { key: string; battery?: string; panels: number }[];
  generators: {
    key: string;
    x: number;
    y: number;
    depth: number;
    panels: number;
    directPanels: string[];
    batteries: string[];
    room: Room;
  }[];
  batteries: { key: string; x: number; y: number; depth: number; panels: number }[];
  fridges: { key: string; batteries: string[]; panels: string[] }[];
  lights: { key: string; x: number; y: number; depth: number; batteries: string[]; panels: string[] }[];
  panels: number;
  exposedPanels: number;
}
/** Panels prefer the nearest battery; batteries feed one nearby generator. */
export function powerNetwork(terrain: Terrain, data: Settlement): PowerNetwork {
  const generators = Object.entries(data.pieces)
    .filter(([, p]) => p.kind === "oxygenGenerator")
    .map(([key]) => {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      return {
        key,
        x: x!,
        y,
        depth,
        panels: 0,
        batteries: [] as string[],
        directPanels: [] as string[],
        room: depth === 0 && data.pieces[key]?.rotation === undefined
          ? analyzeRoom(terrain, data, x, y)
          : analyzeSpatialRoom(terrain, data, x, y, depth),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const batteries = Object.entries(data.pieces)
    .filter(([, p]) => p.kind === "battery")
    .map(([key]) => {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      return { key, x, y, depth, panels: 0 };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  function nearest<T extends { x: number; y: number; depth: number }>(
    nodes: T[],
    x: number,
    y: number,
    depth: number,
  ) {
    let result: T | undefined,
      distance = POWER_RANGE + 0.00001;
    for (const node of nodes) {
      const d = Math.hypot(node.x - x, node.y - y, node.depth - depth);
      if (d < distance) {
        distance = d;
        result = node;
      }
    }
    return result;
  }
  for (const battery of batteries)
    nearest(generators, battery.x, battery.y, battery.depth)?.batteries.push(battery.key);
  const panels = Object.entries(data.pieces).filter(
    ([, p]) => p.kind === "solarPanel",
  );
  const fridges = Object.entries(data.pieces)
    .filter(([, piece]) => piece.kind === "fridge")
    .map(([key]) => {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      return {
        key,
        x: x!,
        y,
        depth,
        batteries: batteries
          .filter((b) => Math.hypot(b.x - x!, b.y - y, b.depth - depth) <= POWER_RANGE)
          .map((b) => b.key),
        panels: [] as string[],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const lights = Object.entries(data.pieces)
    .filter(([, piece]) => isBaseLight(piece.kind))
    .map(([key]) => {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      return { key, x, y, depth,
        batteries: batteries.filter(b => Math.hypot(b.x - x, b.y - y, b.depth - depth) <= POWER_RANGE).map(b => b.key),
        panels: [] as string[] };
    }).sort((a,b) => a.key.localeCompare(b.key));
  const facilities = Object.entries(data.pieces).filter(([, piece]) => isFacility(piece.kind)).map(([key, piece]) => {
    const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
    return { key, x, y, depth, exposed: !["observatory", "climateCollector", "weatherStation"].includes(piece.kind) || exposedToSky(terrain, data, x, y, depth),
      batteries: batteries.filter(b => Math.hypot(b.x - x, b.y - y, b.depth - depth) <= POWER_RANGE).map(b => b.key), panels: [] as string[] };
  }).sort((a, b) => a.key.localeCompare(b.key));
  const exposed: { x: number; y: number; depth: number }[] = [];
  let exposedPanels = 0;
  for (const [key] of panels) {
    const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
    if (!exposedToSky(terrain, data, x, y, depth)) continue;
    exposedPanels++;
    exposed.push({ x, y, depth });
    const battery = nearest(batteries, x, y, depth);
    if (battery) {
      battery.panels++;
      continue;
    }
    const generator = nearest(
      generators.filter((g) => !g.batteries.length),
      x,
      y,
      depth,
    );
    if (generator) {
      generator.panels++;
      generator.directPanels.push(key);
    }
    for (const consumer of [...fridges, ...lights, ...facilities])
      if (Math.hypot(consumer.x - x!, consumer.y - y, consumer.depth - depth) <= POWER_RANGE)
        consumer.panels.push(key);
  }
  const planetary = Object.entries(data.pieces)
    .filter(([, piece]) => piece.kind === "planetaryOxygenGenerator")
    .map(([key]) => {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      return {
        key,
        panels: exposed.filter((p) => Math.hypot(p.x - x, p.y - y, p.depth - depth) <= POWER_RANGE).length,
        battery: nearest(batteries, x, y, depth)?.key,
      };
    });
  return {
    elevatorPanels: exposed, facilities, facilityPlanet: terrain.planet,
    planetary,
    generators,
    batteries,
    fridges,
    lights,
    panels: panels.length,
    exposedPanels,
  };
}
/** Each battery and panel has a single consumer, so power is never duplicated. */
export function advancePowerNetwork(
  data: Settlement,
  network: PowerNetwork,
  from: number,
  to: number,
  runFacilities = false,
) {
  if (network.fridges.length || network.planetary.length || network.lights.length || network.facilities.length) {
    for (let start = from; start < to;) {
      const end = Math.min(to, start + 1);
      advancePowerStep(data, network, start, end, runFacilities);
      start = end;
    }
    if (from === to)
      for (const generator of network.planetary) {
        const battery = generator.battery ? data.pieces[generator.battery] : undefined;
        data.pieces[generator.key]!.powered = generator.panels >= 5 && (battery?.energy ?? 0) > 0;
      }
    for (const fridge of network.fridges) {
      const piece = data.pieces[fridge.key]!;
      const available =
        fridge.panels.length * daylight(to) * SOLAR_RATE >= FRIDGE_RATE ||
        fridge.batteries.some((key) => (data.pieces[key]?.energy ?? 0) > 0);
      piece.powered = available && (from === to || piece.powered === true);
    }
    for (const light of network.lights) {
      const piece = data.pieces[light.key]!;
      const available = light.panels.length * daylight(to) * SOLAR_RATE >= lightRate(piece.kind) ||
        light.batteries.some(key => (data.pieces[key]?.energy ?? 0) > 0);
      piece.powered = available && (from === to || piece.powered === true);
      if (piece.kind === "emergencyLight")
        piece.emergencyActive = !piece.powered && (piece.backupEnergy ?? 0) > 0;
    }
    return;
  }
  advancePowerStep(data, network, from, to, runFacilities);
}

function advancePowerStep(
  data: Settlement,
  network: PowerNetwork,
  from: number,
  to: number,
  runFacilities = false,
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
  const panelEnergy = new Map<string, number>();
  function takeSolar(keys: string[], needed: number) {
    let supplied = 0;
    for (const key of keys) {
      const available = panelEnergy.get(key) ?? SOLAR_RATE * sun;
      const used = Math.min(available, needed - supplied);
      panelEnergy.set(key, available - used);
      supplied += used;
    }
    return supplied;
  }
  for (const generator of network.generators) {
    const piece = data.pieces[generator.key]!;
    if (!generator.batteries.length && !network.fridges.length && !network.lights.length && !network.facilities.length) {
      advanceGenerator(piece, generator.panels, from, to);
      continue;
    }
    let needed = Math.max(
      0,
      Math.min(OXYGEN_CAP - (piece.oxygen ?? 0), GENERATOR_RATE * elapsed) / 3,
    );
    let suppliedEnergy = takeSolar(generator.directPanels, needed);
    needed -= suppliedEnergy;
    for (const key of generator.batteries) {
      const battery = data.pieces[key]!,
        supplied = Math.min(needed, battery.energy ?? 0);
      battery.energy = Math.max(0, (battery.energy ?? 0) - supplied);
      suppliedEnergy += supplied;
      needed -= supplied;
    }
    advanceGenerator(piece, 0, from, to, suppliedEnergy);
  }
  for (const generator of network.planetary) {
    const battery = generator.battery ? data.pieces[generator.battery] : undefined;
    const charge = battery?.energy ?? 0;
    const demand = elapsed;
    const used = generator.panels >= 5 ? Math.min(charge, demand) : 0;
    if (battery) battery.energy = charge - used;
    data.pieces[generator.key]!.powered = used >= demand && (battery?.energy ?? 0) > 0;
  }
  for (const fridge of network.fridges) {
    const demand = FRIDGE_RATE * elapsed;
    let supplied = takeSolar(fridge.panels, demand);
    for (const key of fridge.batteries) {
      const battery = data.pieces[key]!;
      const used = Math.min(demand - supplied, battery.energy ?? 0);
      battery.energy = (battery.energy ?? 0) - used;
      supplied += used;
    }
    const warmTime = Math.max(0, elapsed - supplied / FRIDGE_RATE);
    data.pieces[fridge.key]!.powered = warmTime < 1e-8;
    const inventory = data.cabinets[fridge.key];
    if (warmTime && inventory?.meatBatches)
      inventory.meatBatches = inventory.meatBatches.map((batch) => ({
        ...batch,
        expires: batch.expires - warmTime,
      }));
  }
  // Scientific/industrial facilities share the same energy pool after life support.
  for (const node of runFacilities ? network.facilities : []) {
    const piece = data.pieces[node.key]!;
    if (!isFacility(piece.kind)) continue;
    const machine = ((data.machines ??= {})[node.key] ??= emptyFacility());
    const collecting = piece.kind === "climateCollector" && !!(network.facilityPlanet && weatherAt(network.facilityPlanet, to));
    const active = node.exposed && !machine.blocked && (piece.kind === "weatherStation" || piece.kind === "communicationsPost" || piece.kind === "tradingPost" || collecting || machine.queue.length > 0);
    piece.powered = false;
    if (!active) continue;
    const rate = facilityDefinitions[piece.kind].watts;
    const demand = rate * elapsed;
    let supplied = takeSolar(node.panels, demand);
    for (const key of node.batteries) {
      const battery = data.pieces[key]!;
      const used = Math.min(demand - supplied, Math.max(0, battery.energy ?? 0));
      battery.energy = (battery.energy ?? 0) - used; supplied += used;
    }
    machine.energySeconds = (machine.energySeconds ?? 0) + supplied / rate;
    piece.powered = supplied >= demand - 1e-8;
  }
  // Life support and refrigeration get priority; lights consume only what remains.
  for (const light of network.lights) {
    const piece = data.pieces[light.key]!;
    const demand = lightRate(piece.kind) * elapsed;
    let supplied = takeSolar(light.panels, demand);
    for (const key of light.batteries) {
      const battery = data.pieces[key]!;
      const used = Math.min(demand - supplied, battery.energy ?? 0);
      battery.energy = Math.max(0, (battery.energy ?? 0) - used);
      supplied += used;
    }
    advanceBaseLight(piece, supplied, elapsed);
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
  planetaryActive?: boolean;
  planetaryInstalled?: boolean;
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
  if (report.planetaryActive) return "Atmosfera abastecida pelo gerador planetário";
  if (report.planetaryInstalled && !report.supplied && !report.hasGenerator)
    return "Gerador planetário desligado · Verifique as placas e a bateria";
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
