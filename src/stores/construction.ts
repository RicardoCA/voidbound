import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";
import { craft } from "../crafting/recipes";
import { COOKING_TIME_MS, cookedMeatRecipe } from "../survival/food";
import { BACKPACK_SLOTS, useGame } from "./game";
import type { BuildItem, Inventory, Item } from "../game/types";
import { items } from "../game/types";
import { Terrain } from "../game/procedural/terrain";
import {
  treeAt,
  treesInRange,
  treeContains,
  treeNames,
  type AlienTree,
} from "../game/procedural/trees";
import {
  emptySettlement,
  settlementFor,
  placementError,
  placePiece,
  removePiece,
  inReach,
  transfer,
  addBatch,
  cabinetCapacity,
} from "../construction/building";
import { releaseControls } from "../game/input";
import { audio } from "../game/systems/audio";
import { BATTERY_CAP } from "../construction/habitat";
import {
  pieceAt,
  footprint,
  overlapsActor,
  isCabinet,
  cabinetWidths,
} from "../construction/pieces";
export const useConstruction = defineStore("construction", () => {
  const g = useGame(),
    enabled = ref(false),
    removing = ref(false),
    lastError = ref(""),
    selected = ref<BuildItem>("woodBlock"),
    facing = ref<1 | -1>(1),
    cursor = ref<{ x: number; y: number } | null>(null),
    activeCampfire = ref<{ planetId: string; x: number; y: number } | null>(
      null,
    ),
    activeCabinet = ref<{ planetId: string; key: string } | null>(null);
  const blank = emptySettlement();
  const settlement = computed(() => g.state.settlements[g.planet.id] ?? blank);
  const terrain = computed(
    () => new Terrain(g.planet, g.state.changes[g.planet.id] ?? {}),
  );
  const containerKind = computed(() => {
    const cabinet = activeCabinet.value;
    if (cabinet?.planetId !== g.planet.id) return undefined;
    const kind = settlement.value.pieces[cabinet.key]?.kind;
    return isCabinet(kind) ? kind : undefined;
  });
  const containerCapacity = computed(() =>
    containerKind.value ? cabinetCapacity(containerKind.value) : 0,
  );
  function cabinetInReach(key: string) {
    const kind = settlement.value.pieces[key]?.kind;
    if (!isCabinet(kind)) return false;
    const [x, y] = key.split(",").map(Number);
    return inReach(g.state.player, x! + (cabinetWidths[kind] - 1) / 2, y!, 76);
  }
  const container = computed(() =>
    activeCabinet.value?.planetId === g.planet.id
      ? settlement.value.cabinets[activeCabinet.value.key]
      : undefined,
  );
  const selectedCount = computed(() => g.state.backpack[selected.value] ?? 0);
  function context() {
    return {
      terrain: terrain.value,
      settlement: settlementFor(g.state, g.planet.id),
      inventory: g.state.backpack,
      capacity: BACKPACK_SLOTS,
      player: g.state.player,
      landingX: g.state.landingX,
    };
  }
  function openPalette() {
    if (g.state.mode !== "surface") {
      g.notify("Saia da nave para construir no planeta.");
      return;
    }
    releaseControls();
    g.panel = "build";
  }
  function equip(kind: BuildItem) {
    if (g.state.mode !== "surface") return;
    lastError.value = "";
    selected.value = kind;
    cursor.value = null;
    enabled.value = true;
    removing.value = false;
    g.panel = "";
    releaseControls();
    g.notify(
      `${items[kind].name}: toque ou clique em uma célula vazia. B sai da construção.`,
    );
  }
  function disable() {
    enabled.value = false;
    lastError.value = "";
    cursor.value = null;
    releaseControls();
  }
  function rotate() {
    facing.value = facing.value === 1 ? -1 : 1;
  }
  function errorAt(x: number, y: number) {
    const ctx = context(),
      error = placementError(ctx, selected.value, x, y, facing.value);
    if (error) return error;
    const cells = footprint(selected.value, x, y);
    if (
      selected.value !== "woodWall" &&
      treesInRange(
        g.planet,
        terrain.value,
        x - 1,
        Math.max(...cells.map((cell) => cell.x)) + 1,
        settlement.value.cutTrees,
      ).some((tree) =>
        cells.some((cell) =>
          treeContains(tree, cell.x * 16 + 8, cell.y * 16 + 8),
        ),
      )
    )
      return "Corte a árvore antes de construir neste tronco.";
  }
  function apply(x: number, y: number) {
    if (g.state.mode !== "surface" || g.paused || g.panel || !enabled.value)
      return false;
    g.refreshHabitat();
    let error: string | undefined;
    if (removing.value)
      error = removePiece(context(), x, y, selected.value === "woodWall");
    else {
      error = errorAt(x, y);
      if (!error)
        error = placePiece(context(), selected.value, x, y, facing.value);
    }
    if (error) {
      lastError.value = error;
      g.notify(error);
      return false;
    }
    lastError.value = "";
    if (
      !removing.value &&
      ["solarPanel", "battery", "oxygenGenerator"].includes(selected.value)
    )
      settlementFor(g.state, g.planet.id).utilityTime = g.state.time;
    g.worldChanged();
    audio.play(removing.value ? 260 : 520, 0.08);
    void g.save();
    return true;
  }
  function harvest(tree: AlienTree) {
    if (g.state.mode !== "surface" || g.state.player.energy < 3) return false;
    const current = treeAt(
      g.planet,
      terrain.value,
      Number(tree.id.split(":")[1]),
    );
    if (
      !current ||
      current.id !== tree.id ||
      Math.hypot(
        current.x * 16 + 8 - g.state.player.x,
        current.ground * 16 - 8 - g.state.player.y,
      ) > 96
    )
      return false;
    const data = settlementFor(g.state, g.planet.id);
    if (data.cutTrees.includes(current.id)) return false;
    if (!addBatch(g.state.backpack, { wood: current.wood }, BACKPACK_SLOTS)) {
      g.notify("Mochila cheia. Libere espaço antes de cortar a árvore.");
      return false;
    }
    data.cutTrees.push(current.id);
    g.state.player.energy -= 3;
    audio.play(170, 0.15);
    g.notify(`${treeNames[current.kind]}: +${current.wood} madeiras.`);
    void g.save();
    return true;
  }
  function openCabinet(key: string) {
    if (
      g.state.mode !== "surface" ||
      !isCabinet(settlement.value.pieces[key]?.kind)
    )
      return false;
    if (!cabinetInReach(key)) {
      g.notify("Aproxime-se do armário para abri-lo.");
      return false;
    }
    activeCabinet.value = { planetId: g.planet.id, key };
    releaseControls();
    g.panel = "storage";
    return true;
  }
  function toggleDoor(key: string) {
    const piece = settlement.value.pieces[key];
    if (g.state.mode !== "surface" || piece?.kind !== "woodDoor") return false;
    const [x, y] = key.split(",").map(Number);
    if (!inReach(g.state.player, x!, y!, 76)) {
      g.notify("Aproxime-se da porta para interagir.");
      return false;
    }
    if (piece.open && overlapsActor("woodDoor", x!, y!, g.state.player)) {
      g.notify("Afaste-se do vão antes de fechar a porta.");
      return false;
    }
    g.refreshHabitat();
    piece.open = !piece.open;
    g.worldChanged();
    audio.play(piece.open ? 310 : 220, 0.12);
    g.notify(piece.open ? "Porta aberta." : "Porta fechada.");
    void g.save();
    return true;
  }
  function interactAt(x: number, y: number) {
    const found = pieceAt(settlement.value, x, y);
    if (!found) return false;
    if (found.piece.kind === "campfire") {
      if (
        g.state.mode === "surface" &&
        inReach(g.state.player, found.x, found.y, 76)
      ) {
        activeCampfire.value = {
          planetId: g.planet.id,
          x: found.x,
          y: found.y,
        };
        releaseControls();
        g.panel = "cook";
      } else g.notify("Aproxime-se da fogueira para cozinhar.");
      return true;
    }
    if (found.piece.kind === "woodDoor") {
      toggleDoor(found.key);
      return true;
    }
    if (isCabinet(found.piece.kind)) {
      openCabinet(found.key);
      return true;
    }
    if (
      found.piece.kind === "battery" &&
      inReach(g.state.player, found.x, found.y, 76)
    ) {
      g.refreshHabitat();
      g.notify(
        `Bateria: ${Math.floor(found.piece.energy ?? 0)}/${BATTERY_CAP} energia (${Math.floor((100 * (found.piece.energy ?? 0)) / BATTERY_CAP)}%).`,
      );
      return true;
    }
    if (
      found.piece.kind === "oxygenGenerator" &&
      inReach(g.state.player, found.x, found.y, 76)
    ) {
      g.notify(
        `Gerador sem bateria interna · O₂ ${Math.floor(found.piece.oxygen ?? 0)}/100.`,
      );
      return true;
    }
    return false;
  }
  const cookingElapsed = ref<number | null>(null);
  let cookingTimer: ReturnType<typeof setInterval> | undefined;
  function stopCooking() {
    clearInterval(cookingTimer);
    cookingElapsed.value = null;
  }
  watch([() => g.panel, () => g.paused, () => g.state], stopCooking, {
    flush: "sync",
  });
  onScopeDispose(stopCooking);

  function canCook() {
    const fire = activeCampfire.value;
    return (
      fire &&
      g.state.mode === "surface" &&
      !g.paused &&
      g.panel === "cook" &&
      fire.planetId === g.planet.id &&
      inReach(g.state.player, fire.x, fire.y, 76) &&
      pieceAt(settlement.value, fire.x, fire.y)?.piece.kind === "campfire"
    );
  }
  function cookMeat() {
    if (cookingElapsed.value !== null) return;
    if (!canCook()) {
      g.notify("Aproxime-se de uma fogueira instalada.");
      return;
    }
    if (!g.state.backpack.rawMeat) {
      g.notify("Você precisa de carne crua.");
      return;
    }
    const startedAt = performance.now();
    cookingElapsed.value = 0;
    cookingTimer = setInterval(() => {
      if (!canCook()) {
        stopCooking();
        return;
      }
      cookingElapsed.value = Math.min(
        COOKING_TIME_MS,
        performance.now() - startedAt,
      );
      if (cookingElapsed.value < COOKING_TIME_MS) return;
      stopCooking();
      if (
        !craft(
          g.state.backpack,
          cookedMeatRecipe,
          BACKPACK_SLOTS,
          g.state.mission,
        )
      ) {
        g.notify("Carne crua insuficiente ou mochila sem espaço.");
        return;
      }
      g.notify("Carne assada pronta. Abra a mochila para comer.");
      audio.play(520);
      void g.save();
    }, 100);
  }
  function nearestInteraction() {
    let key: string | undefined,
      distance = 76;
    for (const [id, piece] of Object.entries(settlement.value.pieces)) {
      if (
        !isCabinet(piece.kind) &&
        !["woodDoor", "campfire", "battery", "oxygenGenerator"].includes(
          piece.kind,
        )
      )
        continue;
      const [x, y] = id.split(",").map(Number),
        d = Math.hypot(
          x! * 16 +
            (isCabinet(piece.kind) ? cabinetWidths[piece.kind] * 8 : 8) -
            g.state.player.x,
          y! * 16 + (piece.kind === "woodDoor" ? 0 : 8) - g.state.player.y,
        );
      if (d < distance) {
        distance = d;
        key = id;
      }
    }
    return { key, distance };
  }
  function moveItem(
    direction: "deposit" | "withdraw",
    id: Item,
    quantity: number,
  ) {
    const cabinet = activeCabinet.value;
    if (!cabinet || cabinet.planetId !== g.planet.id || !container.value)
      return false;
    if (g.state.mode !== "surface" || !cabinetInReach(cabinet.key))
      return false;
    const source: Inventory =
        direction === "deposit" ? g.state.backpack : container.value,
      destination =
        direction === "deposit" ? container.value : g.state.backpack;
    if (
      !transfer(
        source,
        destination,
        id,
        quantity,
        direction === "deposit" ? containerCapacity.value : BACKPACK_SLOTS,
      )
    ) {
      g.notify(
        "Transferência recusada: confira a quantidade e o espaço disponível.",
      );
      return false;
    }
    audio.play(450);
    void g.save();
    return true;
  }
  function setCursor(x: number, y: number) {
    if (cursor.value?.x !== x || cursor.value?.y !== y) lastError.value = "";
    cursor.value = { x, y };
  }
  function cabinetAt(x: number, y: number) {
    return isCabinet(pieceAt(settlement.value, x, y)?.piece.kind);
  }
  watch(
    () => [g.state, g.state.mode, g.planet.id],
    () => {
      if (g.state.mode !== "surface") {
        enabled.value = false;
        cursor.value = null;
        activeCabinet.value = null;
      }
    },
    { flush: "sync" },
  );
  return {
    enabled,
    lastError,
    removing,
    selected,
    facing,
    cursor,
    settlement,
    terrain,
    container,
    containerKind,
    containerCapacity,
    activeCabinet,
    selectedCount,
    openPalette,
    equip,
    disable,
    rotate,
    errorAt,
    apply,
    harvest,
    openCabinet,
    nearestInteraction,
    toggleDoor,
    interactAt,
    cookMeat,
    cookingElapsed,
    moveItem,
    setCursor,
    cabinetAt,
  };
});
