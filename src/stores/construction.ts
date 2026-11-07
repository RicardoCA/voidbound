import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useGame } from "./game";
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
  keyAt,
  inReach,
  transfer,
  addBatch,
  CABINET_SLOTS,
} from "../construction/building";
import { releaseControls } from "../game/input";
import { audio } from "../game/systems/audio";
import { BATTERY_CAP } from "../construction/habitat";
import { pieceAt, footprint, overlapsActor } from "../construction/pieces";
export const useConstruction = defineStore("construction", () => {
  const g = useGame(),
    enabled = ref(false),
    removing = ref(false),
    lastError = ref(""),
    selected = ref<BuildItem>("woodBlock"),
    facing = ref<1 | -1>(1),
    cursor = ref<{ x: number; y: number } | null>(null),
    activeCabinet = ref<{ planetId: string; key: string } | null>(null);
  const blank = emptySettlement();
  const settlement = computed(() => g.state.settlements[g.planet.id] ?? blank);
  const terrain = computed(
    () => new Terrain(g.planet, g.state.changes[g.planet.id] ?? {}),
  );
  const container = computed(() =>
    activeCabinet.value?.planetId === g.planet.id
      ? settlement.value.cabinets[activeCabinet.value.key]
      : undefined,
  );
  const selectedCount = computed(() => g.state.inventory[selected.value] ?? 0);
  function context() {
    return {
      terrain: terrain.value,
      settlement: settlementFor(g.state, g.planet.id),
      inventory: g.state.inventory,
      capacity: g.capacity,
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
    if (
      selected.value !== "woodWall" &&
      treesInRange(
        g.planet,
        terrain.value,
        x - 1,
        x + 1,
        settlement.value.cutTrees,
      ).some((tree) =>
        footprint(selected.value, x, y).some((cell) =>
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
    if (!addBatch(g.state.inventory, { wood: current.wood }, g.capacity)) {
      g.notify("Carga cheia. Libere espaço antes de cortar a árvore.");
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
      settlement.value.pieces[key]?.kind !== "cabinet"
    )
      return false;
    const [x, y] = key.split(",").map(Number);
    if (!inReach(g.state.player, x!, y!, 76)) {
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
    if (found.piece.kind === "woodDoor") {
      toggleDoor(found.key);
      return true;
    }
    if (found.piece.kind === "cabinet") {
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
        `Gerador: energia ${Math.floor(found.piece.energy ?? 0)}/100 · O₂ ${Math.floor(found.piece.oxygen ?? 0)}/100.`,
      );
      return true;
    }
    return false;
  }
  function nearestInteraction() {
    let key: string | undefined,
      distance = 76;
    for (const [id, piece] of Object.entries(settlement.value.pieces)) {
      if (
        !["cabinet", "woodDoor", "battery", "oxygenGenerator"].includes(
          piece.kind,
        )
      )
        continue;
      const [x, y] = id.split(",").map(Number),
        d = Math.hypot(
          x! * 16 + 8 - g.state.player.x,
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
    const [x, y] = cabinet.key.split(",").map(Number);
    if (g.state.mode !== "surface" || !inReach(g.state.player, x!, y!, 76))
      return false;
    const source: Inventory =
        direction === "deposit" ? g.state.inventory : container.value,
      destination =
        direction === "deposit" ? container.value : g.state.inventory;
    if (
      !transfer(
        source,
        destination,
        id,
        quantity,
        direction === "deposit" ? CABINET_SLOTS : g.capacity,
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
    return settlement.value.pieces[keyAt(x, y)]?.kind === "cabinet";
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
    moveItem,
    setCursor,
    cabinetAt,
  };
});
