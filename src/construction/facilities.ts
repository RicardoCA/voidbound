import type {
  Inventory,
  Item,
  Planet,
  Save,
  Settlement,
  StarSystem,
} from "../game/types";
import { items } from "../game/types";
import { add, consume, inventoryEntries } from "../inventory/inventory";
import { tileItems, Terrain } from "../game/procedural/terrain";
import { weatherAt, forecastWeather } from "../game/procedural/weather";
import { anomalyAt, ruinAt } from "../progression/exploration";
import { awardCareerXP } from "../progression/careers";
import {
  facilityDefinitions,
  isFacility,
  emptyFacility,
  type FacilityKind,
  type FacilityState,
  type FacilityClue,
} from "./facilityTypes";
export const FACILITY_SLOTS = 16;
export const refineryRecipes: Record<
  string,
  {
    name: string;
    cost: Inventory;
    output: Item;
    amount: number;
    seconds: number;
  }
> = {
  plate: {
    name: "Placa metálica",
    cost: { iron: 3 },
    output: "plate",
    amount: 1,
    seconds: 12,
  },
  circuit: {
    name: "Circuito básico",
    cost: { copper: 2, silicon: 1 },
    output: "circuit",
    amount: 1,
    seconds: 15,
  },
  cell: {
    name: "Célula energética",
    cost: { crystal: 2, copper: 1 },
    output: "cell",
    amount: 1,
    seconds: 18,
  },
  fuel: {
    name: "Combustível refinado",
    cost: { rawFuel: 3 },
    output: "fuel",
    amount: 1,
    seconds: 12,
  },
  meltIce: {
    name: "Derreter gelo",
    cost: { ice: 2 },
    output: "water",
    amount: 1,
    seconds: 8,
  },
  recoverAcid: {
    name: "Recuperar silício do resíduo",
    cost: { acidResidue: 3 },
    output: "silicon",
    amount: 1,
    seconds: 15,
  },
  electrolyse: {
    name: "Eletrólise de água",
    cost: { water: 3, plate: 1 },
    output: "oxygen",
    amount: 1,
    seconds: 20,
  },
};
export const sampleItems: Item[] = [
  "iron",
  "copper",
  "silicon",
  "carbon",
  "titanium",
  "crystal",
  "stone",
  "fiber",
  "basaltBerry",
  "amberFig",
  "frostPlum",
  "jadePear",
  "emberFruit",
  "tideMelon",
  "ruinFragment",
];
export function facilityAccepts(kind: FacilityKind, id: Item) {
  if (kind === "sampleLab") return sampleItems.includes(id);
  return (
    kind === "planetRefinery" &&
    Object.values(refineryRecipes).some((recipe) => (recipe.cost[id] ?? 0) > 0)
  );
}
export function machineAt(data: Settlement, key: string) {
  const kind = data.pieces[key]?.kind;
  if (!kind || !isFacility(kind)) return;
  return ((data.machines ??= {})[key] ??= emptyFacility());
}
export function facilityInReach(state: Save, planetId: string, key: string) {
  if (
    state.mode !== "surface" ||
    !isFacility(state.settlements[planetId]?.pieces[key]?.kind ?? "")
  )
    return false;
  const [x, y, z = 0] = key.split(",").map(Number);
  return (
    [x, y, z].every(Number.isSafeInteger) &&
    Math.hypot(
      (x! + 1) * 16 - state.player.x,
      y! * 16 + 8 - state.player.y,
      z * 16 - (state.player.surfaceZ ?? 0),
    ) <= 76
  );
}
export function jobSeconds(kind: FacilityKind, recipe: string) {
  return kind === "planetRefinery"
    ? (refineryRecipes[recipe]?.seconds ?? 12)
    : facilityDefinitions[kind].seconds;
}
export function enqueueFacility(
  data: Settlement,
  key: string,
  recipe: string,
  quantity: number,
) {
  const kind = data.pieces[key]?.kind;
  if (!kind || !isFacility(kind)) return "Instalação indisponível.";
  const machine = machineAt(data, key)!;
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 100 ||
    machine.queue.reduce((n, job) => n + job.remaining, 0) + quantity > 100
  )
    return "A fila aceita até 100 operações.";
  let cost: Inventory = {};
  if (kind === "planetRefinery") {
    if (!refineryRecipes[recipe]) return "Receita inválida.";
    cost = refineryRecipes[recipe]!.cost;
  } else if (kind === "sampleLab") {
    if (!sampleItems.includes(recipe as Item)) return "Amostra inválida.";
    cost = { [recipe]: 1 };
  } else if (
    (kind !== "observatory" && kind !== "geoProbe") ||
    recipe !== "scan"
  )
    return "Esta instalação opera automaticamente.";
  const total: Inventory = Object.fromEntries(
    inventoryEntries(cost).map(([id, n]) => [id, n * quantity]),
  );
  if (Object.keys(total).length && !consume(machine.input, total))
    return "Deposite todos os ingredientes no reservatório de entrada.";
  machine.queue.push({ recipe, remaining: quantity, progress: 0 });
  machine.message =
    "Fila preparada. Trabalha enquanto você explora; menus e pausa interrompem o tempo ativo.";
}
export function geologicalDeposits(
  terrain: Terrain,
  key: string,
): FacilityClue[] {
  const [cx = 0, cy = 0, cz = 0] = key.split(",").map(Number);
  const result: (FacilityClue & { distance: number })[] = [];
  for (let x = cx - 10; x <= cx + 10; x++)
    for (let y = Math.max(1, cy - 4); y <= Math.min(62, cy + 12); y++)
      for (let z = cz - 5; z <= cz + 5; z++) {
        const tile = terrain.getAt(x, y, z),
          item = tileItems[tile];
        if (tile < 2 || tile > 8 || !item) continue;
        result.push({
          name: items[item].name,
          x: x * 16 + 8,
          y: y * 16 + 8,
          z: z * 16,
          distance: Math.hypot(x - cx, y - cy, z - cz),
        });
      }
  return result
    .sort((a, b) => a.distance - b.distance)
    .filter(
      (entry, i, all) =>
        all.findIndex((other) => other.name === entry.name) === i,
    )
    .slice(0, 6);
}
export function observatoryClues(
  state: Save,
  system: StarSystem,
): FacilityClue[] {
  const found: FacilityClue[] = [];
  const anomaly = anomalyAt(system);
  if (anomaly && !state.progression.discoveries[anomaly.id])
    found.push({
      name: anomaly.name + " · sinal no espaço",
      x: anomaly.x,
      y: anomaly.y,
    });
  for (const planet of system.planets) {
    if (state.progression.discoveries[`ruin:${planet.id}`]) continue;
    const terrain = new Terrain(planet, state.changes[planet.id] ?? {});
    const ruin = ruinAt(planet, terrain, state.settlements[planet.id]);
    if (ruin)
      found.push({
        name: `Ruína em ${planet.name} · procure na superfície`,
        x: ruin.x,
        y: ruin.y,
        planetId: planet.id,
      });
  }
  return found;
}
function analyse(
  state: Save,
  planet: Planet,
  system: StarSystem,
  machine: FacilityState,
  recipe: string,
) {
  const data = state.settlements[planet.id]!;
  const analyses = (data.analyses ??= {});
  const count = analyses[recipe] ?? 0;
  const base =
    recipe === "ruinFragment"
      ? 2200
      : recipe === "crystal" || recipe === "titanium"
        ? 900
        : 550;
  const credits = Math.floor(
    base * (count === 0 ? 1 : Math.max(0.15, 0.45 / count)),
  );
  const id = `sample:${planet.id}:${recipe}:${count}`;
  if (state.progression.discoveries[id]) return;
  state.progression.discoveries[id] = {
    id,
    kind: "survey",
    name: `Análise · ${items[recipe as Item].name} · ${planet.name}`,
    planetId: planet.id,
    systemId: system.id,
    sector: { x: system.x, y: system.y },
    time: state.time,
    notes: count
      ? "Amostra repetida: valor científico reduzido."
      : "Primeira análise desta amostra neste planeta.",
    credits,
  };
  analyses[recipe] = count + 1;
  awardCareerXP(
    state.progression,
    "explorer",
    count ? 8 : 60,
    "Análise planetária",
    state.time,
  );
  machine.message = `Dados registrados no diário: ${credits} CR base. Venda na estação normal.`;
}
export function advanceFacility(
  state: Save,
  planet: Planet,
  system: StarSystem,
  terrain: Terrain,
  key: string,
  dt: number,
) {
  const data = state.settlements[planet.id]!;
  const kind = data.pieces[key]?.kind;
  if (!kind || !isFacility(kind)) return;
  const machine = machineAt(data, key)!;
  const powered = Math.max(0, Math.min(dt, machine.energySeconds ?? 0));
  machine.energySeconds = 0;
  if (kind === "climateCollector") {
    const weather = weatherAt(planet, state.time);
    if (!weather || !powered) return;
    const item =
      weather.kind === "snow"
        ? "ice"
        : weather.kind === "acid"
          ? "acidResidue"
          : "water";
    const progress = (machine.collection ?? 0) + powered * weather.intensity;
    machine.collection = Math.min(10, progress);
    if (progress >= 10) {
      if (!add(machine.output, item, 1, FACILITY_SLOTS)) {
        machine.blocked = true;
        machine.message = "Reservatório cheio. Retire os materiais.";
      } else {
        machine.collection = progress - 10;
        machine.blocked = false;
        machine.message = `${items[item].name} coletado.`;
      }
    }
    return;
  }
  const job = machine.queue[0];
  if (!job) return;
  job.progress = Math.min(jobSeconds(kind, job.recipe), job.progress + powered);
  if (job.progress < jobSeconds(kind, job.recipe)) return;
  if (kind === "planetRefinery") {
    const recipe = refineryRecipes[job.recipe];
    if (
      !recipe ||
      !add(machine.output, recipe.output, recipe.amount, FACILITY_SLOTS)
    ) {
      machine.blocked = true;
      machine.message =
        "Saída cheia. A fila será retomada após retirar os produtos.";
      return;
    }
    machine.message = `${recipe.name} pronto.`;
  } else if (kind === "sampleLab")
    analyse(state, planet, system, machine, job.recipe);
  else if (kind === "observatory") {
    machine.clues = observatoryClues(state, system);
    machine.message = machine.clues.length
      ? "Pistas encontradas. Visite os locais para catalogá-los."
      : "Nenhum sinal ainda não catalogado foi encontrado neste sistema.";
  } else if (kind === "geoProbe") {
    machine.clues = geologicalDeposits(terrain, key);
    machine.message = machine.clues.length
      ? "Leitura concluída. Depósitos podem mudar ao serem minerados."
      : "Nenhum depósito mineral próximo.";
  }
  machine.blocked = false;
  job.remaining--;
  job.progress = 0;
  if (job.remaining <= 0) machine.queue.shift();
}
export function facilityBearing(clue: FacilityClue, player: Save["player"]) {
  if (clue.x === undefined || clue.y === undefined) return "";
  const dx = clue.x - player.x,
    dz = (clue.z ?? 0) - (player.surfaceZ ?? 0);
  const direction =
    Math.abs(dx) + Math.abs(dz) < 8
      ? "Aqui"
      : `${Math.abs(dz) > 8 ? (dz < 0 ? "Norte" : "Sul") : ""} ${Math.abs(dx) > 8 ? (dx < 0 ? "Oeste" : "Leste") : ""}`.trim();
  const depth = Math.round((clue.y - player.y) / 16);
  return `${direction} · ${Math.round(Math.hypot(dx, dz) / 16)} blocos · ${Math.abs(depth)} ${depth >= 0 ? "abaixo" : "acima"}`;
}
export function climateForecast(planet: Planet, time: number) {
  return forecastWeather(planet, time);
}
