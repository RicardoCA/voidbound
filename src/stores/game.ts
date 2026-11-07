import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Item, Save } from "../game/types";
import { biomes, items } from "../game/types";
import { systemAt, planetPosition } from "../universe/generator";
import { add, consume, slots } from "../inventory/inventory";
import { craft, recipes } from "../crafting/recipes";
import { database } from "../persistence/database";
import { audio } from "../game/systems/audio";
import { HabitatSystem } from "../game/systems/habitat";
import { emptyHabitat } from "../construction/habitat";
import { releaseControls } from "../game/input";
import { advancePilotTrips } from "../fleet/pilots";
import { shipModels } from "../fleet/models";
import { shipCapacity, shipFuelCapacity } from "../fleet/hangar";
import { INITIAL_CREDITS } from "../economy/market";
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
    text: "Na estação da nave, fabrique 2 placas, 2 circuitos e um kit de reparo.",
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
    player: { x: 0, y: 0, health: 100, oxygen: 100, energy: 100 },
    inventory: {},
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
export const useGame = defineStore("game", () => {
  const habitatSystem = new HabitatSystem(),
    habitat = ref(emptyHabitat()),
    worldRevision = ref(0);
  function worldChanged() {
    worldRevision.value++;
  }
  const state = ref<Save>(initial("VOIDBOUND")),
    started = ref(false),
    panel = ref(""),
    paused = ref(false),
    notice = ref("Sinal de emergência detectado. Explore o planeta próximo."),
    saveStatus = ref("Sem salvamento"),
    saveRevision = ref(0),
    hasSave = ref(false),
    busy = ref(false),
    speed = ref(0),
    trading = ref(false);
  const system = computed(() =>
      systemAt(state.value.seed, state.value.systemX, state.value.systemY),
    ),
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
    biome = computed(() => biomes[planet.value.kind]!),
    model = computed(() => shipModels[state.value.activeShip.model]),
    capacity = computed(() =>
      shipCapacity(state.value.activeShip.model, state.value.upgrades),
    ),
    hullPercent = computed(
      () => (100 * state.value.ship.hull) / model.value.hull,
    ),
    usedSlots = computed(() => slots(state.value.inventory)),
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
  async function save() {
    if (!started.value || trading.value) return;
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
    trading.value = true;
    try {
      const draft = JSON.parse(JSON.stringify(state.value)) as Save;
      const error = operation(draft, station.id);
      if (error) {
        notify(error);
        return false;
      }
      await database.write(draft);
      state.value = draft;
      recordSave();
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
      s.mode !== "space" ||
      !station ||
      stationDistance.value > 115
    )
      return false;
    if (Math.hypot(s.ship.vx, s.ship.vy) > 35) {
      notify("Freie até 35 km/s para acoplar à estação.");
      return true;
    }
    Object.assign(s.ship, { x: station.x, y: station.y, vx: 0, vy: 0 });
    s.mode = "docked";
    speed.value = 0;
    releaseControls();
    notify(`Acoplagem confirmada. ${station.name}.`);
    void save();
    return true;
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
    if (!add(state.value.inventory, id, n, capacity.value)) {
      notify("Carga cheia. Fabrique ou use itens para liberar espaço.");
      return false;
    }
    audio.play(380);
    const inv = state.value.inventory;
    if (
      (inv.iron ?? 0) >= 6 &&
      (inv.copper ?? 0) >= 4 &&
      (inv.silicon ?? 0) >= 2
    )
      flag("collected");
    progress();
    return true;
  }
  function make(id: Item) {
    const recipe = recipes.find((r) => r.id === id);
    if (trading.value) return;
    if (
      state.value.mode !== "interior" &&
      state.value.mode !== "docked" &&
      !(state.value.mode === "surface" && recipe?.station === "hand")
    ) {
      notify("Entre na nave para acessar a estação de fabricação.");
      return;
    }
    if (
      !recipe ||
      !craft(state.value.inventory, recipe, capacity.value, state.value.mission)
    ) {
      notify("Materiais insuficientes, receita bloqueada ou carga cheia.");
      return;
    }
    flag(`crafted:${id}`);
    audio.play(640, 0.12);
    notify(`${recipe.amount ?? 1} × ${items[id].name} fabricado.`);
    progress();
    void save();
  }
  function use(id: Item) {
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
    if (trading.value) return;
    if (upgrades.includes(id) && s.mode !== "interior" && s.mode !== "docked") {
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
    if (!consume(s.inventory, { [id]: 1 })) return;
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
  function land(zone: number) {
    state.value.landingX = zone * 24;
    state.value.mode = "interior";
    state.value.player.x = zone * 384 + 8;
    state.value.player.y = 0;
    if (state.value.mission === 0) state.value.mission = 1;
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
  function takeoff() {
    if (hullPercent.value < 70) {
      notify("Repare o casco até pelo menos 70% antes de decolar.");
      return;
    }
    if (state.value.ship.fuel < 5) {
      notify(
        "Combustível insuficiente. Use a refinaria ou a recuperação solar.",
      );
      return;
    }
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
  async function jump(x: number, y: number) {
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
    audio.play(80, 0.7);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    s.ship.fuel -= cost;
    s.systemX = x;
    s.systemY = y;
    s.planetIndex = 0;
    s.ship.x = 200;
    s.ship.y = 330;
    s.ship.vx = 0;
    s.ship.vy = 0;
    const id = systemAt(s.seed, x, y).id;
    if (!s.visited.includes(id)) s.visited.push(id);
    if (s.mission === 5) s.mission = 6;
    panel.value = "";
    busy.value = false;
    notify(`Salto concluído. Sistema ${system.value.name}.`);
    await save();
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
    s.time += dt;
    if (advancePilotTrips(s)) void save();
    habitat.value = habitatSystem.step(
      s,
      planet.value,
      worldRevision.value,
      dt,
    );
    if (s.mode === "surface") {
      s.player.energy = Math.min(100, s.player.energy + dt * 1.4);
      if (!planet.value.breathable && !habitat.value.supplied)
        s.player.oxygen = Math.max(0, s.player.oxygen - dt * 0.38);
      if (s.player.oxygen <= 0) s.player.health -= dt * 7;
      if (
        Math.abs(planet.value.temperature) > 55 &&
        !s.upgrades.includes("shield")
      )
        s.player.health -= dt * 0.5;
      if (s.player.health <= 0) {
        s.player.health = 100;
        s.player.oxygen = 60;
        s.ship.hull = Math.max(15, s.ship.hull - 10);
        s.mode = "interior";
        notify("Resgate de emergência. Penalidade: 10 pontos de casco.");
        void save();
      }
    } else if (s.mode === "interior") {
      const amount = Math.min(dt * 8, s.ship.oxygen, 100 - s.player.oxygen);
      s.ship.oxygen -= amount;
      s.player.oxygen += amount;
      s.player.energy = Math.min(100, s.player.energy + dt * 12);
      s.player.health = Math.min(100, s.player.health + dt * 3);
      s.ship.energy = Math.min(100, s.ship.energy + dt * 8);
    } else s.ship.energy = Math.min(100, s.ship.energy + dt * 5);
  }
  return {
    state,
    habitat,
    worldChanged,
    refreshHabitat,
    started,
    panel,
    paused,
    notice,
    saveStatus,
    saveRevision,
    hasSave,
    busy,
    speed,
    system,
    stationDistance,
    stationBearing,
    trading,
    stationTransaction,
    dock,
    undock,
    planet,
    biome,
    capacity,
    model,
    hullPercent,
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
    make,
    use,
    orbit,
    land,
    exit,
    enter,
    takeoff,
    jump,
    recover,
    tick,
  };
});
