import type { Planet, Save, StarSystem } from "../game/types";
import { biomes } from "../game/types";
import { hash } from "../game/procedural/random";
import type { Terrain } from "../game/procedural/terrain";
import { awardCareerXP, careerLevel } from "./careers";

export interface Discovery {
  id: string;
  kind: "system" | "planet" | "anomaly" | "ruin" | "survey";
  name: string;
  systemId: string;
  planetId?: string;
  sector: { x: number; y: number };
  time: number;
  notes: string;
  credits: number;
  soldAt?: number;
}

export function explorationLevel(state: Save) {
  return careerLevel("explorer", state.progression.careers.explorer.xp).level;
}

export function scienceBonus(state: Save) {
  return (explorationLevel(state) - 1) * (0.25 / 29);
}

export function scannerRange(state: Save) {
  return 240 + (explorationLevel(state) - 1) * 12;
}

function record(
  state: Save,
  system: StarSystem,
  entry: Omit<Discovery, "systemId" | "sector" | "time">,
  xp: number,
) {
  const journal = state.progression.discoveries;
  if (Object.hasOwn(journal, entry.id)) return false;
  journal[entry.id] = {
    ...entry,
    systemId: system.id,
    sector: { x: system.x, y: system.y },
    time: state.time,
  };
  awardCareerXP(state.progression, "explorer", xp, entry.name, state.time);
  return true;
}

export function recordSystemSurvey(state: Save, system: StarSystem) {
  return record(
    state,
    system,
    {
      id: `system:${system.id}`,
      kind: "system",
      name: `Sistema descoberto · ${system.name}`,
      notes: `${system.star} · ${system.planets.length} corpos orbitais`,
      credits: 0,
    },
    100,
  );
}

export function planetScience(planet: Planet) {
  const gases = [
    "Nitrogênio e argônio",
    "Dióxido de carbono e poeira mineral",
    "Nitrogênio e metano",
    "Nitrogênio e oxigênio",
    "Dióxido de carbono e enxofre",
    "Nitrogênio, oxigênio e vapor d’água",
  ];
  return `${biomes[planet.kind]!.name} · ${gases[planet.kind]} · ${planet.breathable ? "respirável" : "traje necessário"} · ${biomes[planet.kind]!.resources}`;
}

export function cataloguePlanet(
  state: Save,
  system: StarSystem,
  planet: Planet,
) {
  const known = Boolean(state.progression.cataloguedPlanets[planet.id]);
  const rare = planet.kind === 4 || planet.radius > 8500;
  const created = record(
    state,
    system,
    {
      id: `planet:${planet.id}`,
      kind: "planet",
      name: `Planeta catalogado · ${planet.name}`,
      planetId: planet.id,
      notes: planetScience(planet),
      credits: rare
        ? 1000 + (hash(planet.id) % 3001)
        : 200 + (hash(planet.id) % 601),
    },
    known ? 0 : 60,
  );
  if (!created) return false;
  state.progression.cataloguedPlanets[planet.id] = true;
  if (
    system.planets.every((body) => state.progression.cataloguedPlanets[body.id])
  ) {
    record(
      state,
      system,
      {
        id: `survey:${system.id}`,
        kind: "survey",
        name: `Levantamento completo · ${system.name}`,
        notes: `${system.planets.length} planetas catalogados`,
        credits: 2000 + (hash(system.id) % 6001),
      },
      0,
    );
  }
  return true;
}

export interface ScienceSite {
  id: string;
  kind: "anomaly" | "ruin";
  name: string;
  x: number;
  y: number;
  level: number;
  credits: number;
  planetId?: string;
}

export function anomalyAt(system: StarSystem): ScienceSite | undefined {
  const seed = hash(`${system.id}:anomaly`);
  if (seed % 3 !== 0) return;
  const legendary = seed % 19 === 0;
  return {
    id: `anomaly:${system.id}`,
    kind: "anomaly",
    name: legendary ? "Anomalia lendária" : "Anomalia gravitacional",
    x: 400 + (seed % 650),
    y: -120 - (seed % 210),
    level: legendary ? 19 : 1,
    credits: legendary ? 25000 + (seed % 25001) : 5000 + (seed % 15001),
  };
}

export function ruinAt(
  planet: Planet,
  terrain: Terrain,
): ScienceSite | undefined {
  const seed = hash(`${planet.id}:ruin`);
  if (seed % 4 !== 0) return;
  const tile = 14 + (seed % 7);
  return {
    id: `ruin:${planet.id}`,
    kind: "ruin",
    name: "Ruína alienígena",
    x: tile * 16 + 8,
    y: terrain.height(tile) * 16 - 14,
    level: 1,
    credits: 2500 + (seed % 4501),
    planetId: planet.id,
  };
}

export function scanSite(state: Save, system: StarSystem, site: ScienceSite) {
  const actor = site.kind === "ruin" ? state.player : state.ship;
  if (
    explorationLevel(state) < site.level ||
    Math.hypot(site.x - actor.x, site.y - actor.y) > scannerRange(state)
  )
    return false;
  return record(
    state,
    system,
    {
      id: site.id,
      kind: site.kind,
      name: site.name,
      planetId: site.planetId,
      notes: `Sinal registrado em ${Math.round(site.x)}, ${Math.round(site.y)}`,
      credits: site.credits,
    },
    site.kind === "ruin" ? 300 : 250,
  );
}

export function scienceValue(state: Save, entry: Discovery) {
  return Math.floor(entry.credits * (1 + scienceBonus(state)));
}

export function sellScience(state: Save, id: string) {
  const entry = state.progression.discoveries[id];
  if (
    state.mode !== "docked" ||
    !entry ||
    !entry.credits ||
    entry.soldAt !== undefined
  )
    return "Dados indisponíveis para venda.";
  const balance = state.credits + scienceValue(state, entry);
  if (!Number.isSafeInteger(balance)) return "Limite de créditos atingido.";
  state.credits = balance;
  entry.soldAt = state.time;
}
