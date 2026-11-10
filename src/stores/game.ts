import {
  BLACK_HOLE_DURATION_MS,
  blackHoleDestination,
  blackHolePull,
} from "../universe/blackHoles";
import {
  canCraftWeapon,
  cycleWeapon,
  isWeaponModule,
  selectedWeapon,
  shipWeapons,
  type WeaponModule,
} from "../combat/weapons";
import {
  canCraftScanner,
  isShipScanner,
  type ScannerContact,
} from "../combat/shipScanners";
import { isHeatDeflector, stellarExposure } from "../universe/stars";
import type { CabinEquipment } from "../game/cabin/CabinInterior";
import { wantedStatus } from "../combat/law";
import type { FlightContact, SpaceNpc } from "../combat/traffic";
import {
  anomalyAt,
  cataloguePlanet,
  explorationLevel,
  recordSystemSurvey,
  ruinAt,
  scanSite,
  scannerRange,
} from "../progression/exploration";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Item, Save, Settlement } from "../game/types";
import { biomes, items } from "../game/types";
import { systemAt, planetPosition } from "../universe/generator";
import { add, consume, slots } from "../inventory/inventory";
import { craft, recipes } from "../crafting/recipes";
import { database } from "../persistence/database";
import { audio } from "../game/systems/audio";
import { HabitatSystem } from "../game/systems/habitat";
import { emptySettlement, transfer } from "../construction/building";
import {
  awardCareerXP,
  newProgression,
  recordMining,
  miningEfficiency,
} from "../progression/careers";
import { Terrain, tileItems } from "../game/procedural/terrain";
import { weatherAt, weatherCeiling } from "../game/procedural/weather";
import {
  advancePowerNetwork,
  emptyHabitat,
  PLANET_DAY,
  planetClock,
  powerNetwork,
  type PowerNetwork,
} from "../construction/habitat";
import { releaseControls } from "../game/input";
import { advancePilotTrips } from "../fleet/pilots";
import { shipModels } from "../fleet/models";
import { shipCapacity, shipFuelCapacity } from "../fleet/hangar";
import {
  FOOD_SICKNESS_DURATION,
  RAW_MEAT_RISK,
  foodValue,
} from "../survival/food";
import { planetAddress } from "../construction/catalog";
import { addMeatBatches, spoilMeat } from "../survival/perishables";
import { INITIAL_CREDITS } from "../economy/market";
export const BACKPACK_SLOTS = 24;
export const PLANET_SCAN_SECONDS = 10;
export const JUMP_DURATION_MS = 5000;
export const DOCKING_DURATION = 1.8;
export const SURFACE_SEQUENCE_DURATION = {
  landing: 2.3,
  disembark: 1.1,
  takeoff: 5,
} as const;
type SurfaceSequence = {
  kind: keyof typeof SURFACE_SEQUENCE_DURATION;
  landingX: number;
  elapsed: number;
};

export const missions = [
  {
    title: "Sinal perdido",
    text: "Aproxime-se do planeta e entre em órbita. Escolha um ponto de pouso.",
  },
  {
    title: "Primeiros recursos",
    text: "Saia da nave. Colete 6 ferros, 4 cobres e 2 silícios com a multitool.",
  },
  {
    title: "Reparo de emergência",
    text: "Guarde os recursos da mochila no armário de carga. Na bancada, fabrique 2 placas, 2 circuitos e um kit de reparo.",
  },
  {
    title: "De volta ao espaço",
    text: "Use o kit de reparo e decole. A refinaria converte combustível bruto.",
  },
  {
    title: "Além do horizonte",
    text: "Minere asteroides. Fabrique e instale uma melhoria da nave.",
  },
  {
    title: "O primeiro salto",
    text: "Instale o propulsor de salto. No mapa galáctico, viaje a outro sistema.",
  },
  {
    title: "Fronteiras do infinito",
    text: "O universo é seu. Explore novos sistemas e biomas, colete e evolua.",
  },
];
function initial(seed: string): Save {
  return {
    version: 4,
    progression: newProgression(),
    credits: INITIAL_CREDITS,
    activeShip: { id: "ship-1", model: "sparrow" },
    parkedShips: [],
    nextShipId: 2,
    marketStocks: {},
    settlements: {},
    seed,
    mode: "space",
    systemX: 0,
    systemY: 0,
    planetIndex: 0,
    ship: {
      x: 200,
      y: 330,
      angle: 0,
      vx: 0,
      vy: 0,
      hull: 55,
      fuel: 85,
      energy: 100,
      oxygen: 100,
    },
    player: { x: 0, y: 0, health: 100, oxygen: 100, energy: 100, hunger: 100 },
    inventory: {},
    backpack: {},
    upgrades: [],
    changes: {},
    depleted: [],
    visited: [`${seed}:0:0`],
    mission: 0,
    flags: [],
    time: 0,
    landingX: 0,
  };
}
function gameplayPreference(name: string) {
  const key = `voidbound:option:${name}`;
  let enabled = true;
  try {
    enabled =
      typeof window === "undefined" ||
      window.localStorage.getItem(key) !== "off";
  } catch {
    // The preference can still be changed for the current session.
  }
  const option = ref(enabled);
  watch(
    option,
    (value) => {
      try {
        if (typeof window !== "undefined")
          window.localStorage.setItem(key, value ? "on" : "off");
      } catch {
        // Storage can be disabled in some browser sessions.
      }
    },
    { flush: "sync" },
  );
  return option;
}
export const useGame = defineStore("game", () => {
  const habitatSystem = new HabitatSystem(),
    habitat = ref(emptyHabitat()),
    worldRevision = ref(0);
  function worldChanged() {
    worldRevision.value++;
  }
  const noShelter = emptySettlement();
  const survivorEnabled = gameplayPreference("survivor");
  const hungerEnabled = gameplayPreference("hunger");
  const autosaveEnabled = gameplayPreference("autosave");
  const state = ref<Save>(initial("VOIDBOUND")),
    started = ref(false),
    surfaceSequence = ref<SurfaceSequence>(),
    dockingSequence = ref<{ elapsed: number }>(),
    planetScan = ref<{ index: number; name: string; elapsed: number }>(),
    panel = ref(""),
    paused = ref(false),
    notice = ref("Sinal de emergência detectado. Explore o planeta próximo."),
    saveStatus = ref("Sem salvamento"),
    saveRevision = ref(0),
    hasSave = ref(false),
    busy = ref(false),
    blackHoleTransit = ref<{ elapsed: number; x: number; y: number }>(),
    speed = ref(0),
    flightContact = ref<FlightContact>(),
    shipScanContacts = ref<ScannerContact[]>([]),
    radarShips = ref<
      Pick<
        SpaceNpc,
        "id" | "name" | "x" | "y" | "role" | "engaged" | "bountyTarget"
      >[]
    >([]),
    stationContact = ref<string>(),
    cabinContact = ref<CabinEquipment>(),
    trading = ref(false);
  watch(
    started,
    (playing) => {
      if (!playing) {
        surfaceSequence.value = undefined;
        dockingSequence.value = undefined;
        if (blackHoleTransit.value) {
          blackHoleTransit.value = undefined;
          busy.value = false;
        }
      }
    },
    { flush: "sync" },
  );
  const standingInFlight = ref(false);
  const flightCabin = computed(
    () => state.value.mode === "space" && standingInFlight.value,
  );
  const routeIndex = ref<number>();
  const routePlanet = computed(() =>
    routeIndex.value === undefined
      ? undefined
      : system.value.planets[routeIndex.value],
  );
  watch(
    () => [
      started.value,
      state.value.mode,
      state.value.seed,
      state.value.systemX,
      state.value.systemY,
    ],
    () => {
      routeIndex.value = undefined;
      standingInFlight.value = false;
      planetScan.value = undefined;
    },
    { flush: "sync" },
  );
  function standInFlight() {
    if (
      state.value.mode !== "space" ||
      paused.value ||
      busy.value ||
      inSequence.value ||
      panel.value
    )
      return;
    releaseControls();
    standingInFlight.value = true;
  }
  function setRoute(index: number) {
    const planet = system.value.planets[index];
    if (
      !planet ||
      state.value.mode !== "space" ||
      flightCabin.value ||
      inSequence.value ||
      paused.value ||
      busy.value
    )
      return;
    routeIndex.value = index;
    panel.value = "";
    releaseControls();
    notify("Piloto automático a caminho de " + planet.name + ".");
  }
  function clearRoute(message?: string) {
    routeIndex.value = undefined;
    if (message) notify(message);
  }
  const inSequence = computed(() =>
    Boolean(surfaceSequence.value || dockingSequence.value),
  );
  const system = computed(() =>
      systemAt(state.value.seed, state.value.systemX, state.value.systemY),
    ),
    wanted = computed(() => wantedStatus(state.value, system.value)),
    stationDistance = computed(() => {
      const station = system.value.station;
      const { x, y } = state.value.ship;
      return station ? Math.hypot(x - station.x, y - station.y) : Infinity;
    }),
    stationBearing = computed(() => {
      const station = system.value.station;
      if (!station) return "";
      const { x, y } = state.value.ship;
      const octant = Math.round(
        Math.atan2(station.y - y, station.x - x) / (Math.PI / 4),
      );
      return ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][(octant + 8) % 8];
    }),
    planet = computed(() => system.value.planets[state.value.planetIndex]!),
    weather = computed(() => weatherAt(planet.value, state.value.time)),
    planetTerrain = computed(
      () =>
        new Terrain(planet.value, state.value.changes[planet.value.id] ?? {}),
    ),
    biome = computed(() => biomes[planet.value.kind]!),
    sicknessRemaining = computed(() =>
      Math.ceil(state.value.player.sickness ?? 0),
    ),
    extractionEfficiency = computed(() =>
      miningEfficiency(state.value.progression),
    ),
    model = computed(() => shipModels[state.value.activeShip.model]),
    capacity = computed(() =>
      shipCapacity(state.value.activeShip.model, state.value.upgrades),
    ),
    hullPercent = computed(
      () => (100 * state.value.ship.hull) / model.value.hull,
    ),
    usedSlots = computed(() => slots(state.value.inventory)),
    onSurface = computed(() => state.value.mode === "surface"),
    workingInventory = computed(() =>
      onSurface.value ? state.value.backpack : state.value.inventory,
    ),
    workingCapacity = computed(() =>
      onSurface.value ? BACKPACK_SLOTS : capacity.value,
    ),
    canAccessShipCargo = computed(
      () =>
        state.value.mode === "interior" ||
        state.value.mode === "docked" ||
        flightCabin.value,
    ),
    mission = computed(() => missions[state.value.mission]!),
    showMission = computed(() => state.value.mission < missions.length - 1),
    maxFuel = computed(() =>
      shipFuelCapacity(state.value.activeShip.model, state.value.upgrades),
    ),
    jumpRange = computed(() =>
      state.value.upgrades.includes("engine") ? 4 : 2,
    );
  function notify(message: string) {
    notice.value = message;
  }
  function flag(id: string) {
    if (!state.value.flags.includes(id)) state.value.flags.push(id);
  }
  function progress() {
    const s = state.value;
    if (s.mission === 1 && s.flags.includes("collected")) s.mission = 2;
    if (
      s.mission === 2 &&
      s.flags.includes("crafted:repair") &&
      s.flags.includes("crafted:circuit")
    )
      s.mission = 3;
    if (s.mission === 4 && s.flags.includes("asteroid") && s.upgrades.length)
      s.mission = 5;
  }
  function recordSave() {
    hasSave.value = true;
    saveRevision.value++;
    saveStatus.value = `Salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  async function save(manual = false) {
    if (!started.value || trading.value || (!manual && !autosaveEnabled.value))
      return;
    try {
      await database.write(state.value);
      recordSave();
      return true;
    } catch {
      saveStatus.value = "Falha ao salvar";
      notify(
        "Não foi possível salvar. Verifique o armazenamento do navegador.",
      );
    }
  }
  async function stationTransaction(
    operation: (draft: Save, stationId: string) => string | undefined,
  ) {
    const station = system.value.station;
    if (
      trading.value ||
      !started.value ||
      paused.value ||
      state.value.mode !== "docked" ||
      !station
    )
      return false;
    refreshFood();
    trading.value = true;
    try {
      const draft = JSON.parse(JSON.stringify(state.value)) as Save;
      const error = operation(draft, station.id);
      if (error) {
        notify(error);
        return false;
      }
      const persist = autosaveEnabled.value;
      if (persist) await database.write(draft);
      state.value = draft;
      if (persist) recordSave();
      return true;
    } catch {
      notify("Operação cancelada. Não foi possível gravar a transação.");
      return false;
    } finally {
      trading.value = false;
    }
  }
  function dock() {
    const s = state.value,
      station = system.value.station;
    if (
      !started.value ||
      paused.value ||
      panel.value ||
      busy.value ||
      inSequence.value ||
      s.mode !== "space" ||
      !station ||
      stationDistance.value > 115
    )
      return false;
    if (wanted.value.level >= 5) {
      notify(
        "Acoplagem bloqueada pela autoridade local. Procure outro sistema ou aguarde o alerta diminuir.",
      );
      return true;
    }
    if (Math.hypot(s.ship.vx, s.ship.vy) > 35) {
      notify("Freie até 35 km/s para acoplar à estação.");
      return true;
    }
    releaseControls();
    dockingSequence.value = { elapsed: 0 };
    return true;
  }
  function advanceDocking(dt: number) {
    const sequence = dockingSequence.value;
    const station = system.value.station;
    if (!sequence || !station || paused.value || !started.value) return;
    sequence.elapsed += dt;
    if (sequence.elapsed < DOCKING_DURATION) return;
    dockingSequence.value = undefined;
    const s = state.value;
    Object.assign(s.ship, {
      x: station.x,
      y: station.y,
      angle: 0,
      vx: 0,
      vy: 0,
    });
    s.mode = "docked";
    speed.value = 0;
    releaseControls();
    notify(`Acoplagem confirmada. ${station.name}.`);
    void save();
  }
  function undock() {
    const s = state.value,
      station = system.value.station;
    if (trading.value || paused.value || s.mode !== "docked" || !station)
      return;
    Object.assign(s.ship, {
      x: station.x + 42,
      y: station.y,
      vx: 0,
      vy: 0,
      angle: 0,
    });
    s.mode = "space";
    panel.value = "";
    releaseControls();
    notify("Desacoplagem confirmada.");
    void save();
  }
  async function checkSave() {
    try {
      hasSave.value = !!(await database.read());
    } catch {
      notify("Armazenamento local indisponível.");
    }
  }
  function newGame(seed: string) {
    state.value = initial(seed.trim() || "VOIDBOUND");
    started.value = true;
    panel.value = "";
    paused.value = false;
    void save();
  }
  async function resume() {
    try {
      const s = await database.read();
      if (s) {
        state.value = s;
        refreshFood();
        started.value = true;
        panel.value = "";
        paused.value = false;
        notify("Diário de bordo recuperado. Bem-vindo de volta.");
      }
    } catch {
      notify("Não foi possível recuperar a partida.");
    }
  }
  function collect(id: Item, n = 1) {
    if (!add(workingInventory.value, id, n, workingCapacity.value)) {
      notify(
        onSurface.value
          ? "Mochila cheia. Use ou guarde itens para liberar espaço."
          : "Carga cheia. Fabrique ou use itens para liberar espaço.",
      );
      return false;
    }
    if (id === "rawMeat")
      addMeatBatches(workingInventory.value, [
        { amount: n, expires: state.value.time + PLANET_DAY },
      ]);
    audio.play(380);
    const inv = workingInventory.value;
    if (
      (inv.iron ?? 0) >= 6 &&
      (inv.copper ?? 0) >= 4 &&
      (inv.silicon ?? 0) >= 2
    )
      flag("collected");
    progress();
    return true;
  }
  function mineTerrain(terrain: Terrain, x: number, y: number) {
    const s = state.value;
    if (
      s.mode !== "surface" ||
      terrain.planet.id !== planet.value.id ||
      terrain.changes !== s.changes[planet.value.id] ||
      y < 0 ||
      y >= 63
    )
      return false;
    const tile = terrain.get(x, y);
    if (!tile) return false;
    const resource = tileItems[tile] ?? "iron";
    if (!collect(resource)) return false;
    terrain.remove(x, y);
    worldChanged();
    if (resource !== "wood" && resource !== "fiber")
      recordMining(s.progression, 1, s.time);
    if (resource === "titanium" || resource === "crystal") {
      const deposit = `${planet.value.id}:${Math.floor(x / 32)}:${resource}`;
      if (!s.progression.rareDeposits[deposit]) {
        s.progression.rareDeposits[deposit] = true;
        awardCareerXP(
          s.progression,
          "miner",
          100,
          `Depósito de ${items[resource].name}`,
          s.time,
        );
      }
    }
    return true;
  }
  function mineAsteroid(id: string, ore: Item) {
    const s = state.value;
    if (s.mode !== "space" || s.depleted.includes(id) || !collect(ore, 3))
      return false;
    s.depleted.push(id);
    recordMining(s.progression, 3, s.time);
    flag("asteroid");
    progress();
    void save();
    return true;
  }
  function make(id: Item) {
    const recipe = recipes.find((r) => r.id === id);
    if (trading.value) return;
    if (
      state.value.mode !== "interior" &&
      !flightCabin.value &&
      state.value.mode !== "docked" &&
      !(state.value.mode === "surface" && recipe?.station === "hand")
    ) {
      notify("Entre na nave para acessar a estação de fabricação.");
      return;
    }
    if (!canCraftScanner(state.value, id)) {
      notify("Adquira o projeto do scanner na estação correspondente.");
      return;
    }
    if (!canCraftWeapon(state.value, id)) {
      notify("Compre o projeto no armeiro de uma estação clandestina.");
      return;
    }
    if (
      !recipe ||
      !craft(
        workingInventory.value,
        recipe,
        workingCapacity.value,
        state.value.mission,
      )
    ) {
      notify("Materiais insuficientes, receita bloqueada ou carga cheia.");
      return;
    }
    if (id === "fuel") {
      state.value.progression.refined++;
      awardCareerXP(
        state.value.progression,
        "miner",
        40,
        "Lote refinado",
        state.value.time,
      );
    }
    flag(`crafted:${id}`);
    audio.play(640, 0.12);
    notify(`${recipe.amount ?? 1} × ${items[id].name} fabricado.`);
    progress();
    void save();
  }
  function moveCargo(toShip: boolean, id: Item, quantity: number) {
    if (!canAccessShipCargo.value || trading.value) return false;
    refreshFood();
    const { inventory, backpack } = state.value;
    if (
      !transfer(
        toShip ? backpack : inventory,
        toShip ? inventory : backpack,
        id,
        quantity,
        toShip ? capacity.value : BACKPACK_SLOTS,
      )
    ) {
      notify("Confira a quantidade e o espaço livre no destino.");
      return false;
    }
    notify(`${quantity} × ${items[id].name} transferido.`);
    void save();
    return true;
  }
  const activeWeapon = computed(() => shipWeapons[selectedWeapon(state.value)]);
  const canSwitchWeapon = computed(() =>
    state.value.upgrades.some(isWeaponModule),
  );
  function switchWeapon() {
    if (
      state.value.mode !== "space" ||
      flightCabin.value ||
      panel.value ||
      paused.value ||
      busy.value ||
      inSequence.value ||
      !cycleWeapon(state.value)
    )
      return;
    void save();
  }
  function uninstallWeapon(id: WeaponModule) {
    if (!canAccessShipCargo.value || trading.value || paused.value) return;
    const s = state.value;
    const index = s.upgrades.indexOf(id);
    if (index === -1) return;
    if (!add(s.inventory, id, 1, capacity.value)) {
      notify("Libere um slot na carga da nave antes de desinstalar.");
      return;
    }
    s.upgrades.splice(index, 1);
    if (s.ship.weapon === id) s.ship.weapon = "pulse";
    notify(`${items[id].name} voltou para a carga da nave.`);
    void save();
  }
  function use(id: Item, fromBackpack = onSurface.value) {
    const s = state.value,
      upgrades: Item[] = [
        "engine",
        "laser",
        "tank",
        "shield",
        "cargo",
        "jump",
        "drill",
      ];
    if (isHeatDeflector(id) || isWeaponModule(id) || isShipScanner(id))
      upgrades.push(id);
    if (trading.value || (onSurface.value && !fromBackpack)) return;
    const inventory = fromBackpack ? s.backpack : s.inventory;
    if (id === "rawMeat") refreshFood();
    const nutrition = foodValue(id);
    if (nutrition) {
      if (!hungerEnabled.value) {
        notify("A fome está desativada nas opções.");
        return;
      }
      const hunger = s.player.hunger ?? 100;
      if (hunger >= 100) {
        notify("Você já está alimentado.");
        return;
      }
      if (!consume(inventory, { [id]: 1 })) return;
      s.player.hunger = Math.min(100, hunger + nutrition);
      if (id === "rawMeat" && Math.random() < RAW_MEAT_RISK) {
        s.player.sickness = FOOD_SICKNESS_DURATION;
        notify("Intoxicação alimentar. Você vai perder vida por 30 segundos.");
      } else {
        notify(
          `Alimento consumido. Saciedade: ${Math.ceil(s.player.hunger)}%.`,
        );
      }
      void save();
      return;
    }
    if (
      upgrades.includes(id) &&
      s.mode !== "interior" &&
      !flightCabin.value &&
      s.mode !== "docked"
    ) {
      notify("Instale melhorias dentro da nave.");
      return;
    }
    if (upgrades.includes(id) && s.upgrades.includes(id)) {
      notify("Melhoria já instalada.");
      return;
    }
    if (!["repair", "fuel", "oxygen", "cell", ...upgrades].includes(id)) return;
    if (id === "oxygen" && s.mode === "interior" && s.ship.oxygen >= 100) {
      notify("Reserva de oxigênio já cheia.");
      return;
    }
    if (!consume(inventory, { [id]: 1 })) return;
    if (id === "repair")
      s.ship.hull = Math.min(model.value.hull, s.ship.hull + 50);
    if (id === "fuel") s.ship.fuel = Math.min(maxFuel.value, s.ship.fuel + 30);
    if (id === "oxygen") {
      if (s.mode === "interior")
        s.ship.oxygen = Math.min(100, s.ship.oxygen + 60);
      else s.player.oxygen = Math.min(100, s.player.oxygen + 60);
    }
    if (id === "cell") {
      s.player.energy = 100;
      s.ship.energy = 100;
    }
    if (upgrades.includes(id)) s.upgrades.push(id);
    notify(
      `${items[id].name}: ${upgrades.includes(id) ? "instalado" : "utilizado"}.`,
    );
    progress();
    void save();
  }
  function orbit(index: number) {
    state.value.planetIndex = index;
    state.value.mode = "orbit";
    state.value.ship.vx = 0;
    state.value.ship.vy = 0;
    notify("Selecione uma zona de pouso.");
    void save();
  }
  function beginLanding(zone: number) {
    if (state.value.mode !== "orbit" || surfaceSequence.value || paused.value)
      return;
    releaseControls();
    surfaceSequence.value = {
      kind: "landing",
      landingX: zone * 24,
      elapsed: 0,
    };
  }
  function interactCabin() {
    if (
      !started.value ||
      paused.value ||
      panel.value ||
      inSequence.value ||
      (state.value.mode !== "interior" && !flightCabin.value)
    )
      return;
    const equipment = cabinContact.value;
    if (!equipment) {
      notify("Nenhum equipamento ao alcance.");
      return;
    }
    releaseControls();
    if (equipment === "hatch") {
      if (flightCabin.value) notify("A escotilha só abre após pousar.");
      else beginDisembark();
    } else if (equipment === "solar") recover();
    else if (equipment === "pilot") {
      if (flightCabin.value) standingInFlight.value = false;
      else panel.value = "takeoff";
    } else panel.value = equipment;
  }
  function beginDisembark() {
    if (
      state.value.mode !== "interior" ||
      surfaceSequence.value ||
      paused.value
    )
      return;
    releaseControls();
    surfaceSequence.value = {
      kind: "disembark",
      landingX: state.value.landingX,
      elapsed: 0,
    };
  }
  function advanceSurfaceSequence(dt: number) {
    const sequence = surfaceSequence.value;
    if (!sequence || paused.value || !started.value) return;
    sequence.elapsed += dt;
    if (sequence.elapsed < SURFACE_SEQUENCE_DURATION[sequence.kind]) return;
    surfaceSequence.value = undefined;
    releaseControls();
    if (sequence.kind === "landing") land(sequence.landingX / 24);
    else if (sequence.kind === "takeoff") takeoff();
    else exit();
  }
  function land(zone: number) {
    state.value.landingX = zone * 24;
    state.value.mode = "interior";
    state.value.player.x = zone * 384 + 8;
    state.value.player.y = 0;
    if (state.value.mission === 0) state.value.mission = 1;
    cataloguePlanet(state.value, system.value, planet.value);
    notify("Pouso confirmado. Saia da nave para explorar.");
    void save();
  }
  function exit() {
    state.value.player.x = state.value.landingX * 16 + 40;
    state.value.player.y = 0;
    state.value.mode = "surface";
    panel.value = "";
    void save();
  }
  function enter() {
    state.value.mode = "interior";
    panel.value = "";
    notify("Pressurização concluída. Sistemas da nave disponíveis.");
    void save();
  }
  function canTakeOff() {
    if (hullPercent.value < 70) {
      notify("Repare o casco até pelo menos 70% antes de decolar.");
      return false;
    }
    if (state.value.ship.fuel < 5) {
      notify(
        "Combustível insuficiente. Use a refinaria ou a recuperação solar.",
      );
      return false;
    }
    return true;
  }
  function beginTakeoff() {
    if (
      state.value.mode !== "interior" ||
      inSequence.value ||
      paused.value ||
      !canTakeOff()
    )
      return;
    panel.value = "";
    releaseControls();
    surfaceSequence.value = {
      kind: "takeoff",
      landingX: state.value.landingX,
      elapsed: 0,
    };
    audio.play(100, 0.5);
  }
  function takeoff() {
    if (!canTakeOff()) return;
    state.value.ship.fuel -= 5;
    const pos = planetPosition(state.value.planetIndex);
    state.value.ship.x = pos.x - 210;
    state.value.ship.y = pos.y;
    state.value.ship.vx = -25;
    state.value.ship.vy = 0;
    state.value.mode = "space";
    panel.value = "";
    if (state.value.mission === 3) state.value.mission = 4;
    notify("Decolagem confirmada. Boa viagem, comandante.");
    audio.play(100, 0.5);
    void save();
  }
  function arriveInSystem(x: number, y: number) {
    const s = state.value;
    s.planetIndex = 0;
    s.systemX = x;
    s.systemY = y;
    s.ship.x = 200;
    s.ship.y = 330;
    s.ship.vx = 0;
    s.ship.vy = 0;
    const id = systemAt(s.seed, x, y).id;
    if (!s.visited.includes(id)) {
      s.visited.push(id);
      recordSystemSurvey(s, system.value);
    }
    speed.value = 0;
  }
  const gravityWell = computed(() => {
    const hole = system.value.blackHole;
    return hole && state.value.mode === "space" && !busy.value
      ? blackHolePull(hole, state.value.ship)
      : undefined;
  });
  function captureBlackHole() {
    const hole = system.value.blackHole;
    const s = state.value;
    if (!hole || !gravityWell.value?.captured || busy.value || inSequence.value)
      return false;
    blackHoleTransit.value = {
      elapsed: 0,
      ...blackHoleDestination(s.seed, hole, s.systemX, s.systemY),
    };
    busy.value = true;
    panel.value = "";
    planetScan.value = undefined;
    clearRoute();
    releaseControls();
    notify("Horizonte de eventos cruzado. Destino desconhecido.");
    audio.play(65, 0.7);
    return true;
  }
  function advanceBlackHole(dt: number) {
    const transit = blackHoleTransit.value;
    if (!transit) return;
    transit.elapsed += dt;
    if (transit.elapsed < BLACK_HOLE_DURATION_MS / 1000) return;
    arriveInSystem(transit.x, transit.y);
    blackHoleTransit.value = undefined;
    busy.value = false;
    notify(
      `Travessia concluída. Você emergiu no sistema ${system.value.name}.`,
    );
    void save();
  }
  async function jump(x: number, y: number) {
    if (busy.value || inSequence.value) return;
    const s = state.value,
      d = Math.hypot(x - s.systemX, y - s.systemY),
      cost = Math.ceil(d * 8);
    if (s.mode !== "space") {
      notify("Decole antes de iniciar um salto.");
      return;
    }
    if (!s.upgrades.includes("jump")) {
      notify("Instale um propulsor de salto.");
      return;
    }
    if (d === 0 || d > jumpRange.value || s.ship.fuel < cost) {
      notify("Destino fora de alcance ou combustível insuficiente.");
      return;
    }
    busy.value = true;
    releaseControls();
    audio.play(80, 0.7);
    await new Promise((resolve) => setTimeout(resolve, JUMP_DURATION_MS));
    s.ship.fuel -= cost;
    arriveInSystem(x, y);
    if (s.mission === 5) s.mission = 6;
    panel.value = "";
    busy.value = false;
    notify(`Salto concluído. Sistema ${system.value.name}.`);
    await save();
  }
  const flightTarget = computed(() => {
    const s = state.value;
    const planets = system.value.planets;
    let index = 0;
    let distance = Infinity;
    for (const [i] of planets.entries()) {
      const pos = planetPosition(i);
      const d = Math.hypot(pos.x - s.ship.x, pos.y - s.ship.y);
      if (d < distance) {
        index = i;
        distance = d;
      }
    }
    const target = planets[index]!;
    const range = scannerRange(s);
    const catalogued = Boolean(s.progression.cataloguedPlanets[target.id]);
    const action = catalogued
      ? distance < 210
        ? "orbit"
        : undefined
      : distance <= range
        ? "planet"
        : undefined;
    const anomaly = anomalyAt(system.value);
    if (
      anomaly &&
      !s.progression.discoveries[anomaly.id] &&
      explorationLevel(s) >= anomaly.level
    ) {
      const signalDistance = Math.hypot(
        anomaly.x - s.ship.x,
        anomaly.y - s.ship.y,
      );
      if (signalDistance <= range && (!action || signalDistance < distance)) {
        return {
          index,
          name: anomaly.name,
          distance: signalDistance,
          action: "anomaly" as const,
        };
      }
    }
    return { index, name: target.name, distance, action };
  });
  function interactFlightTarget() {
    const { action, index } = flightTarget.value;
    if (action === "anomaly") scanSignal();
    else if (action === "planet") scanPlanet(index);
    else if (action === "orbit") orbit(index);
    else
      notify("Aproxime-se de um planeta, anomalia ou estação para interagir.");
  }
  function canScanPlanet(index: number) {
    const s = state.value;
    if (s.mode !== "space")
      return (
        ["orbit", "interior", "surface"].includes(s.mode) &&
        s.planetIndex === index
      );
    const pos = planetPosition(index);
    return Math.hypot(pos.x - s.ship.x, pos.y - s.ship.y) <= scannerRange(s);
  }
  function scanPlanet(index: number) {
    const target = system.value.planets[index];
    if (
      !target ||
      !started.value ||
      paused.value ||
      trading.value ||
      busy.value ||
      inSequence.value ||
      planetScan.value
    )
      return;
    if (state.value.progression.cataloguedPlanets[target.id]) {
      notify("Planeta já catalogado.");
      return;
    }
    if (!canScanPlanet(index)) {
      notify("Aproxime-se do planeta para escanear.");
      return;
    }
    planetScan.value = { index, name: target.name, elapsed: 0 };
    notify(`Escaneando ${target.name}…`);
  }
  function advancePlanetScan(dt: number) {
    const scan = planetScan.value;
    if (!scan || paused.value) return;
    const target = system.value.planets[scan.index];
    if (
      !target ||
      busy.value ||
      inSequence.value ||
      !canScanPlanet(scan.index)
    ) {
      planetScan.value = undefined;
      notify("Escaneamento interrompido. Volte ao alcance do planeta.");
      return;
    }
    scan.elapsed += dt;
    if (scan.elapsed < PLANET_SCAN_SECONDS) return;
    planetScan.value = undefined;
    if (!cataloguePlanet(state.value, system.value, target)) return;
    notify(`${target.name} catalogado.`);
    void save();
  }
  function scanSignal() {
    const s = state.value;
    if (trading.value || busy.value) return;
    const signal =
      s.mode === "space"
        ? anomalyAt(system.value)
        : s.mode === "surface"
          ? ruinAt(planet.value, planetTerrain.value)
          : undefined;
    if (!signal || !scanSite(s, system.value, signal)) {
      notify(
        "Sinal fora do alcance, já registrado ou acima do nível do scanner.",
      );
      return;
    }
    notify(`${signal.name} registrada.`);
    void save();
  }
  const fridgeNetworks = new WeakMap<
    Settlement,
    { revision: number; network: PowerNetwork }
  >();
  function refreshFood() {
    const s = state.value;
    for (const [id, data] of Object.entries(s.settlements)) {
      let cached = fridgeNetworks.get(data);
      if (cached?.revision !== worldRevision.value) {
        if (
          !Object.values(data.pieces).some((piece) => piece.kind === "fridge")
        )
          continue;
        const address = planetAddress(s.seed, id);
        if (!address) continue;
        const planet = systemAt(s.seed, address.x, address.y).planets[
          address.planetIndex
        ];
        if (!planet) continue;
        cached = {
          revision: worldRevision.value,
          network: powerNetwork(new Terrain(planet, s.changes[id] ?? {}), data),
        };
        fridgeNetworks.set(data, cached);
      }
      advancePowerNetwork(
        data,
        cached.network,
        Math.min(s.time, data.utilityTime ?? s.time),
        s.time,
      );
      data.utilityTime = s.time;
    }
    return spoilMeat(s);
  }
  function sleepInBed() {
    const s = state.value;
    refreshFood();
    s.time += PLANET_DAY / 3;
    advancePilotTrips(s);
    const spoiled = refreshFood();
    refreshHabitat();
    panel.value = "";
    notify(
      `Você dormiu 8 horas. Hora local: ${planetClock(s.time)}.` +
        (spoiled ? ` Carne crua estragada: ${spoiled}.` : ""),
    );
    void save();
  }
  function recover() {
    if (state.value.mode !== "interior") {
      notify("A recuperação solar funciona com a nave pousada.");
      return;
    }
    state.value.ship.fuel = Math.min(maxFuel.value, state.value.ship.fuel + 5);
    state.value.ship.oxygen = Math.min(100, state.value.ship.oxygen + 5);
    state.value.time += 60;
    advancePilotTrips(state.value);
    refreshFood();
    notify("60 s de recuperação solar: +5 combustível e oxigênio.");
    void save();
  }
  function refreshHabitat() {
    habitat.value = habitatSystem.step(
      state.value,
      planet.value,
      worldRevision.value,
      0,
    );
  }
  function restorePlayer() {
    const player = state.value.player;
    player.health = 100;
    player.oxygen = Math.max(60, player.oxygen);
    if (hungerEnabled.value) player.hunger = Math.max(25, player.hunger);
    delete player.sickness;
  }
  const stellarZones = computed(() =>
    state.value.mode === "space"
      ? stellarExposure(
          system.value.stars,
          state.value.ship,
          state.value.upgrades,
        )
      : [],
  );
  const stellarWarning = computed(() => stellarZones.value[0]);
  function applyStellarHeat(dt: number) {
    const s = state.value;
    if (s.mode !== "space") return false;
    const damage = stellarZones.value.reduce(
      (total, zone) => total + zone.damage,
      0,
    );
    if (!damage) return false;
    s.ship.hull = Math.max(0, s.ship.hull - damage * dt);
    if (s.ship.hull > 0) return false;
    // Move a protected rescue clear of the stellar hazard before saving it.
    s.ship.x = 200;
    s.ship.y = 330;
    speed.value = 0;
    clearRoute();
    handleHullFailure(
      "Resgate térmico. A nave foi estabilizada longe da estrela.",
    );
    return true;
  }
  function handleHullFailure(emergencyMessage: string) {
    const s = state.value;
    if (s.ship.hull > 0) return false;
    if (survivorEnabled.value) {
      s.inventory = {};
      s.backpack = {};
    }
    if (
      !survivorEnabled.value ||
      (s.activeShip.id === "ship-1" && s.activeShip.model === "sparrow") ||
      s.activeShip.rescue
    ) {
      Object.assign(s.ship, {
        hull: 30,
        vx: 0,
        vy: 0,
        fuel: Math.max(s.ship.fuel, 15),
      });
      notify(
        survivorEnabled.value
          ? `${emergencyMessage} Carga e mochila perdidas.`
          : emergencyMessage,
      );
      void save();
      return false;
    }

    const destination = system.value.station
      ? system.value
      : systemAt(s.seed, 0, 0);
    const station = destination.station!;
    const starter = shipModels.sparrow;
    const lost = model.value.name;
    s.activeShip = {
      id: `ship-${s.nextShipId++}`,
      model: "sparrow",
      rescue: true,
    };
    s.ship = {
      x: station.x,
      y: station.y,
      angle: 0,
      vx: 0,
      vy: 0,
      hull: starter.hull,
      fuel: starter.fuel,
      oxygen: 100,
      energy: 100,
    };
    s.upgrades = [...starter.equipment];
    restorePlayer();
    s.systemX = destination.x;
    s.systemY = destination.y;
    s.planetIndex = 0;
    s.mode = "docked";
    panel.value = "";
    speed.value = 0;
    flightContact.value = undefined;
    releaseControls();
    notify(
      `${lost} destruída. Você foi resgatado em ${station.name} com uma Sparrow de emergência.`,
    );
    void save();
    return true;
  }
  function resolvePlayerDeath() {
    const s = state.value;
    if (s.player.health > 0) return false;
    restorePlayer();
    s.ship.hull = Math.max(15, s.ship.hull - 10);
    const lostBackpack = s.mode === "surface" && survivorEnabled.value;
    if (s.mode === "surface") {
      if (lostBackpack) s.backpack = {};
      s.mode = "interior";
      panel.value = "";
      releaseControls();
    }
    notify(
      lostBackpack
        ? "Resgate de emergência. Você perdeu os itens da mochila e voltou à nave."
        : "Resgate de emergência. Penalidade: 10 pontos de casco.",
    );
    void save();
    return true;
  }
  function tick(dt: number) {
    if (
      !started.value ||
      paused.value ||
      panel.value ||
      busy.value ||
      state.value.mode === "docked" ||
      state.value.mode === "orbit"
    )
      return;
    const s = state.value;
    const second = Math.floor(s.time);
    s.time += dt;
    if (second !== Math.floor(s.time)) {
      const spoiled = refreshFood();
      if (spoiled) {
        notify(`${spoiled} × Carne crua estragou fora da geladeira.`);
        void save();
      }
    }
    if (hungerEnabled.value) {
      s.player.hunger = Math.max(0, (s.player.hunger ?? 100) - dt * 0.12);
      if (s.player.hunger === 0) s.player.health -= dt * 3;
    }
    const sickTime = Math.min(dt, s.player.sickness ?? 0);
    if (sickTime > 0) {
      s.player.sickness = s.player.sickness! - sickTime;
      s.player.health -= sickTime;
    }
    if (advancePilotTrips(s)) void save();
    habitat.value = habitatSystem.step(
      s,
      planet.value,
      worldRevision.value,
      dt,
    );
    if (s.mode === "surface") {
      const storm = weather.value;
      if (storm?.kind === "acid") {
        const column = Math.floor(s.player.x / 16);
        const head = Math.floor((s.player.y - 11) / 16);
        const shelter = s.settlements[planet.value.id] ?? noShelter;
        if (
          weatherCeiling(planetTerrain.value, shelter, column, head) ===
          Infinity
        )
          s.player.health -= dt * storm.intensity * 1.5;
      }
      s.player.energy = Math.min(100, s.player.energy + dt * 1.4);
      if (!planet.value.breathable && !habitat.value.supplied)
        s.player.oxygen = Math.max(0, s.player.oxygen - dt * 0.38);
      if (s.player.oxygen <= 0) s.player.health -= dt * 7;
      if (
        Math.abs(planet.value.temperature) > 55 &&
        !s.upgrades.includes("shield")
      )
        s.player.health -= dt * 0.5;
    } else if (s.mode === "interior" || flightCabin.value) {
      const amount = Math.min(dt * 8, s.ship.oxygen, 100 - s.player.oxygen);
      s.ship.oxygen -= amount;
      s.player.oxygen += amount;
      s.player.energy = Math.min(100, s.player.energy + dt * 12);
      if ((!hungerEnabled.value || s.player.hunger > 0) && sickTime === 0)
        s.player.health = Math.min(100, s.player.health + dt * 3);
      s.ship.energy = Math.min(100, s.ship.energy + dt * 8);
    } else s.ship.energy = Math.min(100, s.ship.energy + dt * 5);
    resolvePlayerDeath();
  }
  return {
    state,
    habitat,
    worldChanged,
    refreshHabitat,
    started,
    surfaceSequence,
    dockingSequence,
    inSequence,
    advanceDocking,
    beginLanding,
    beginDisembark,
    advanceSurfaceSequence,
    panel,
    paused,
    notice,
    saveStatus,
    survivorEnabled,
    hungerEnabled,
    autosaveEnabled,
    saveRevision,
    hasSave,
    busy,
    speed,
    flightContact,
    shipScanContacts,
    radarShips,
    activeWeapon,
    canSwitchWeapon,
    switchWeapon,
    uninstallWeapon,
    flightTarget,
    interactFlightTarget,
    stationContact,
    cabinContact,
    flightCabin,
    routeIndex,
    routePlanet,
    standInFlight,
    setRoute,
    clearRoute,
    interactCabin,
    system,
    stationDistance,
    wanted,
    stationBearing,
    trading,
    stationTransaction,
    dock,
    undock,
    planet,
    biome,
    weather,
    capacity,
    canAccessShipCargo,
    moveCargo,
    handleHullFailure,
    applyStellarHeat,
    gravityWell,
    captureBlackHole,
    advanceBlackHole,
    blackHoleTransit,
    stellarWarning,
    resolvePlayerDeath,
    extractionEfficiency,
    model,
    hullPercent,
    sicknessRemaining,
    usedSlots,
    mission,
    showMission,
    maxFuel,
    jumpRange,
    notify,
    flag,
    progress,
    save,
    checkSave,
    newGame,
    resume,
    collect,
    mineTerrain,
    mineAsteroid,
    scanPlanet,
    planetScan,
    advancePlanetScan,
    scanSignal,
    make,
    use,
    orbit,
    land,
    exit,
    enter,
    takeoff,
    beginTakeoff,
    jump,
    recover,
    refreshFood,
    sleepInBed,
    tick,
  };
});
