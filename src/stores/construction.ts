import { systemAt } from "../universe/generator";
import { cargoVisitors, visitorInReach, purchaseVisitor, setSaleItem, respondRequest } from "../construction/planetCommerce";
import { isFacility } from "../construction/facilityTypes";
import { facilityInReach, machineAt, enqueueFacility, FACILITY_SLOTS, facilityAccepts } from "../construction/facilities";
import { isBaseLight, EMERGENCY_CAPACITY } from "../construction/lighting";
import { isDoor, pieceWidth } from "../construction/pieces";
import { toggleAirlockDoor, airlockPartner } from "../construction/airlock";
import { fillCartridge, OXYGEN_FILL_TIME_MS, oxygenFillingProgress } from "../survival/autoOxygen";
import { flight3D } from "../game/rendering/flight3D";
import { defineStore, acceptHMRUpdate } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";
import { craft } from "../crafting/recipes";
import { COOKING_TIME_MS, cookedMeatRecipe } from "../survival/food";
import { BACKPACK_SLOTS, useGame } from "./game";
import type { BuildItem, Inventory, Item } from "../game/types";
import { items } from "../game/types";
import { Terrain, tileForItem } from "../game/procedural/terrain";
import { consume } from "../inventory/inventory";
import { assignableQuickSlots, canAssignQuickSlot, fillQuickSlot } from "../inventory/quickSlots";
import { CROP_GROWTH, cropReady, fruitSeedFor, isSeed, treeSeedFor } from "../survival/seedCatalog";
import { FRUIT_REGROWTH, type Fruit } from "../survival/wildlife";
import { isPhotonSaber } from "../universe/stars";
import {
  treeAt,
  spatialTreeAt,
  spatialTreesNear,
  plantedTreeAt,
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
  isBuildItem,
} from "../construction/building";
import { releaseControls } from "../game/input";
import { audio } from "../game/systems/audio";
import { BATTERY_CAP, powerNetwork } from "../construction/habitat";
import {
  pieceAt,
  footprint,
  overlapsActor,
  isCabinet,
  isOpening,
  isWall,
  cabinetWidths,
} from "../construction/pieces";
export const useConstruction = defineStore("construction", () => {
  const g = useGame(),
    enabled = ref(false),
    removing = ref(false),
    lastError = ref(""),
    selected = ref<BuildItem>("woodBlock"),
    selectedMaterial = ref<Item>(),
    holdingBucket = ref(false),
    rotation = ref(0),
    facing = ref<1 | -1>(1),
    climbingColumn = ref<number>(),
    cursor = ref<{ x: number; y: number; depth?: number } | null>(null),
    activeCampfire = ref<{ planetId: string; x: number; y: number; depth: number } | null>(
      null,
    ),
    activeBed = ref<{ planetId: string; x: number; y: number; depth: number }>(),
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
  const fridgePowered = computed(() => {
    const cabinet = activeCabinet.value;
    return (
      containerKind.value === "fridge" &&
      cabinet !== null &&
      settlement.value.pieces[cabinet.key]?.powered === true
    );
  });
  const containerCapacity = computed(() =>
    containerKind.value ? cabinetCapacity(containerKind.value) : 0,
  );
  function cabinetInReach(key: string) {
    const kind = settlement.value.pieces[key]?.kind;
    if (!isCabinet(kind)) return false;
    const [x, y, depth = 0] = key.split(",").map(Number);
    return Math.abs(depth * 16 - (g.state.player.surfaceZ ?? 0)) <= 24 && inReach(g.state.player, x! + (cabinetWidths[kind] - 1) / 2, y!, 76);
  }
  const container = computed(() =>
    activeCabinet.value?.planetId === g.planet.id
      ? settlement.value.cabinets[activeCabinet.value.key]
      : undefined,
  );
  const selectedItem = computed(() => selectedMaterial.value ?? selected.value);
  const bucketEquipped = computed(() => holdingBucket.value && (g.state.backpack.bucket ?? 0) > 0 && !g.equippedSaber);
  const selectedCount = computed(() => g.state.backpack[selectedItem.value] ?? 0);
  const canRotate = computed(() => !selectedMaterial.value && (flight3D.surfaceView ? !isFacility(selected.value) && selected.value !== "woodBlock" && selected.value !== "workbench" && (!isCabinet(selected.value) || cabinetWidths[selected.value] === 1) : selected.value === "woodStairs"));
  const activeQuickSlot = computed(() => {
    if (removing.value && enabled.value) return;
    const item = enabled.value ? selectedItem.value : bucketEquipped.value ? "bucket" : g.equippedSaber;
    return item ? assignableQuickSlots.find((slot) => g.state.quickSlots?.[slot] === item) : 1;
  });
  function assignQuickSlot(slot: number, item: Item) {
    if (!canAssignQuickSlot(item) || !g.state.backpack[item] ||
        (slot !== 0 && (!Number.isInteger(slot) || slot < 2 || slot > 9))) return;
    const slots = (g.state.quickSlots ??= {});
    for (const number of assignableQuickSlots)
      if (slots[number] === item) delete slots[number];
    if (slot) slots[slot] = item;
    void g.save();
  }
  function activateQuickSlot(slot: number) {
    if (g.state.mode !== "surface" || g.panel || g.paused || g.busy || g.inSequence) return;
    if (slot === 1) {
      disable();
      if (g.equippedSaber) g.use(g.equippedSaber, true);
      return;
    }
    if (!Number.isInteger(slot) || slot < 2 || slot > 9) return;
    const item = g.state.quickSlots?.[slot];
    if (!item || !canAssignQuickSlot(item)) return;
    if (!g.state.backpack[item]) {
      g.notify(`${items[item].name} indisponível na mochila.`);
      return;
    }
    if (isPhotonSaber(item)) {
      disable();
      if (g.equippedSaber !== item) g.use(item, true);
    } else {
      if (g.equippedSaber) g.use(g.equippedSaber, true);
      equip(item);
    }
  }
  function context(depth?: number) {
    return {
      terrain: terrain.value,
      settlement: settlementFor(g.state, g.planet.id),
      inventory: g.state.backpack,
      capacity: BACKPACK_SLOTS,
      player: g.state.player,
      depth,
      rotation: depth === undefined ? undefined : rotation.value,
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
  function equip(kind: Item) {
    if (g.state.mode !== "surface") return;
    const construction = isBuildItem(kind);
    if (kind === "bucket") {
      if (!g.state.backpack.bucket) return;
      disable();
      if (g.equippedSaber) g.use(g.equippedSaber, true);
      holdingBucket.value = true;
      g.panel = "";
      g.notify("Balde equipado. Mire na água e toque ou clique para coletar.");
      return;
    }
    if (!construction && !isSeed(kind) && tileForItem(kind) === undefined) return;
    holdingBucket.value = false;
    lastError.value = "";
    selected.value = construction ? kind : "woodBlock";
    selectedMaterial.value = construction ? undefined : kind;
    if (kind === "workbench" || isFacility(kind)) rotation.value = 0;
    cursor.value = null;
    enabled.value = true;
    removing.value = false;
    g.panel = "";
    releaseControls();
    g.notify(
      isSeed(kind) ? "Toque ou clique sobre terra livre para plantar." :
        `${items[kind].name}: toque ou clique em uma célula vazia. B sai da construção.`,
    );
  }
  function disable() {
    holdingBucket.value = false;
    enabled.value = false;
    lastError.value = "";
    cursor.value = null;
    releaseControls();
  }
  function rotate() {
    if (!canRotate.value) return;
    lastError.value = "";
    if (flight3D.surfaceView) rotation.value = (rotation.value + 1) % 4;
    else facing.value = facing.value === 1 ? -1 : 1;
  }
  function errorAt(x: number, y: number, depth?: number) {
    const ctx = context(depth),
      error = placementError(ctx, selected.value, x, y, facing.value, selectedMaterial.value);
    if (error) return error;
    if (selectedMaterial.value && isSeed(selectedMaterial.value)) {
      if (ctx.terrain.getAt(x, y + 1, depth) !== 1)
        return "Plante em uma célula livre sobre terra.";
      if (depth && spatialTreesNear(ctx.terrain, x * 16 + 8, depth * 16, ctx.settlement.cutTrees)
        .some(tree => tree.x === x && tree.depth === depth && tree.ground === y + 1))
        return "Já existe uma árvore nesta célula.";
    }
    const cells = footprint(selected.value, x, y);
    if (
      !depth && !isWall(selected.value) &&
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
  function apply(x: number, y: number, depth = 0, wallFace?: number) {
    if (g.state.mode !== "surface" || g.paused || g.panel || !enabled.value)
      return false;
    const buildDepth = flight3D.surfaceView || depth ? depth : undefined;
    g.refreshHabitat();
    let error: string | undefined;
    if (removing.value) {
      const ctx = context(buildDepth);
      const key = ctx.terrain.keyAt(x, y, depth);
      const wall = (depth ? ctx.settlement.depthWalls : ctx.settlement.walls)?.[key];
      const foreground = pieceAt(ctx.settlement, x, y, depth);
      if (depth && ctx.settlement.depthBlocks?.[key]) {
        if (!addBatch(ctx.inventory, { woodBlock: 1 }, ctx.capacity)) {
          lastError.value = "Mochila cheia.";
          g.notify(lastError.value);
          return false;
        }
        delete ctx.settlement.depthBlocks[key];
      } else {
        error = removePiece(ctx, x, y, Boolean(wallFace !== undefined || (wall && (isWall(selected.value) || !foreground))), wallFace);
      }
    } else {
      error = errorAt(x, y, buildDepth);
      if (!error) {
        const material = selectedMaterial.value;
        const tile = material && tileForItem(material);
        if (material && isSeed(material)) {
          if (!consume(g.state.backpack, { [material]: 1 })) return false;
          const data = settlementFor(g.state, g.planet.id);
          const key = terrain.value.keyAt(x, y, depth);
          (data.crops ??= {})[key] = { seed: material, growth: 0, moisture: 0 };
          const previous = data.cutTrees.indexOf(`planted-tree:${key}`);
          if (previous >= 0) data.cutTrees.splice(previous, 1);
          g.notify("Muda plantada. Regue com água ou aguarde a chuva.");
        } else if (material && tile) {
          if (!consume(g.state.backpack, { [material]: 1 })) return false;
          g.state.changes[g.planet.id] ??= {};
          const target = terrain.value;
          target.setAt(x, y, depth, tile);
          const deadlines = g.state.terrainRegrowth?.[g.planet.id];
          if (deadlines) delete deadlines[target.keyAt(x, y, depth)];
        } else {
          error = placePiece(context(buildDepth), selected.value, x, y, facing.value);
        }
      }
    }
    if (error) {
      lastError.value = error;
      g.notify(error);
      return false;
    }
    lastError.value = "";
    if (
      !removing.value &&
      ["solarPanel", "battery", "oxygenGenerator", "planetaryOxygenGenerator", "fridge", "floodlight", "emergencyLight"].includes(
        selected.value,
      )
    )
      settlementFor(g.state, g.planet.id).utilityTime = g.state.time;
    g.worldChanged();
    audio.play(removing.value ? 260 : 520, 0.08);
    void g.save();
    return true;
  }
  function harvest(tree: AlienTree) {
    if (g.state.mode !== "surface" || g.state.player.energy < 3) return false;
    const [, cell, layer] = tree.id.split(":");
    const planted = tree.id.startsWith("planted-tree:") ? cell : undefined;
    const current = planted ? plantedTreeAt(terrain.value, settlement.value, planted) : tree.depth
      ? spatialTreeAt(g.planet, terrain.value, Number(cell), Number(layer))
      : treeAt(g.planet, terrain.value, Number(cell));
    if (
      !current ||
      current.id !== tree.id ||
      Math.hypot(
        current.x * 16 + 8 - g.state.player.x,
        current.ground * 16 - 8 - g.state.player.y,
        (current.depth ?? 0) * 16 - (g.state.player.surfaceZ ?? 0),
      ) > 96
    )
      return false;
    const data = settlementFor(g.state, g.planet.id);
    if (data.cutTrees.includes(current.id)) return false;
    data.cutTrees.push(current.id);
    if (planted && data.crops) delete data.crops[planted];
    const drops = (data.woodDrops ??= {});
    const dropId = drops[current.id] ? `${current.id}:${g.state.time}` : current.id;
    drops[dropId] = {
      x: current.x * 16 + 8, y: current.ground * 16 - 8,
      z: current.depth ? current.depth * 16 : 5,
      quantity: current.wood, availableAt: g.state.time + 1.2,
      seed: treeSeedFor(current.kind),
    };
    g.state.player.energy -= 3;
    audio.play(170, 0.15);
    g.notify(`${treeNames[current.kind]} cortada. Aproxime-se para recolher madeira e semente.`);
    void g.save();
    return true;
  }
  function collectWoodDrops() {
    if (g.state.mode !== "surface" || g.paused || g.panel || g.busy) return 0;
    const drops = settlement.value.woodDrops;
    if (!drops) return 0;
    const player = g.state.player;
    let collected = 0;
    let seeds = 0;
    for (const [id, drop] of Object.entries(drops)) {
      if (g.state.time < drop.availableAt ||
        Math.hypot(drop.x - player.x, drop.y - player.y, drop.z - (player.surfaceZ ?? 0)) > 23) continue;
      if (!addBatch(g.state.backpack, {
        wood: drop.quantity, ...(drop.seed ? { [drop.seed]: 1 } : {}),
      }, BACKPACK_SLOTS)) continue;
      if (drop.seed) {
        fillQuickSlot(g.state, drop.seed);
        seeds++;
      }
      collected += drop.quantity;
      delete drops[id];
    }
    if (collected) {
      audio.play(340, .08);
      g.notify(seeds ? `Madeira recolhida: ${collected}. Sementes: ${seeds}.` :
        `+${collected} de madeira alienígena recolhida.`);
      void g.save();
    }
    return collected;
  }

  function collectFruit(fruit: Fruit) {
    if (g.state.mode !== "surface") return false;
    const data = settlementFor(g.state, g.planet.id);
    const seed = fruitSeedFor(fruit.item);
    const cultivated = fruit.id.startsWith("crop:");
    const crop = cultivated ? data.crops?.[fruit.id.slice(5)] : undefined;
    if (cultivated ? crop?.seed !== seed || !cropReady(crop) :
      (data.foraged?.[fruit.id] ?? 0) > g.state.time) return false;
    if (!addBatch(g.state.backpack, { [fruit.item]: 2, [seed]: 1 }, BACKPACK_SLOTS)) {
      g.notify("Mochila sem espaço para as frutas e a muda.");
      return false;
    }
    fillQuickSlot(g.state, seed);
    if (crop) {
      crop.established = true;
      crop.growth = 0;
    }
    else (data.foraged ??= {})[fruit.id] = g.state.time + FRUIT_REGROWTH;
    audio.play(380);
    g.notify("Duas frutas e uma muda coletadas.");
    void g.save();
    return true;
  }

  function waterPlant(x: number, y: number, depth: number) {
    const crop = settlement.value.crops?.[terrain.value.keyAt(x, y, depth)];
    if (!bucketEquipped.value || !crop || g.state.mode !== "surface" || g.panel || g.paused) return false;
    const p = g.state.player;
    if (Math.hypot(x * 16 + 8 - p.x, y * 16 + 8 - p.y, depth * 16 - (p.surfaceZ ?? 0)) > 77) {
      g.notify("Aproxime-se da muda para regar.");
    } else if (cropReady(crop) || crop.moisture >= CROP_GROWTH - crop.growth) {
      g.notify("A muda já tem água suficiente.");
    } else if (consume(g.state.backpack, { water: 1 })) {
      crop.moisture = CROP_GROWTH - crop.growth;
      g.notify("Muda regada.");
      void g.save();
    } else {
      g.notify("Colete água com o balde antes de regar.");
    }
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
    g.refreshFood();
    activeCabinet.value = { planetId: g.planet.id, key };
    releaseControls();
    g.panel = "storage";
    return true;
  }
  function toggleDoor(key: string) {
    const piece = settlement.value.pieces[key];
    if (g.state.mode !== "surface" || !piece || !isOpening(piece.kind))
      return false;
    const [x, y, depth = 0] = key.split(",").map(Number);
    if (Math.abs(depth * 16 - (g.state.player.surfaceZ ?? 0)) > 24 || !inReach(g.state.player, x!, y!, 76)) {
      g.notify("Aproxime-se da porta para interagir.");
      return false;
    }
    if (piece.open && overlapsActor(piece.kind, x!, y!, g.state.player)) {
      g.notify("Afaste-se do vão antes de fechar a porta.");
      return false;
    }
    g.refreshHabitat();
    if (piece.kind === "airlockDoor") {
      const error = toggleAirlockDoor(settlement.value, key, g.state.player);
      if (error) { g.notify(error); return false; }
    } else piece.open = !piece.open;
    g.worldChanged();
    audio.play(piece.open ? 310 : 220, 0.12);
    if (piece.kind === "airlockDoor") {
      g.notify(!airlockPartner(settlement.value, key)
        ? "Porta sem par · Instale outra porta de antecâmara alinhada, no mesmo piso, a até 5 blocos."
        : piece.open ? "Antecâmara aberta · Porta parceira fechada." : "Porta de antecâmara fechada.");
      void g.save();
      return true;
    }
    const hatch = piece.kind === "woodHatch";
    g.notify(
      piece.kind === "fenceGate" ? (piece.open ? "Portão aberto." : "Portão fechado.") :
      hatch
        ? piece.open
          ? "Alçapão aberto."
          : "Alçapão fechado."
        : piece.open
          ? "Porta aberta."
          : "Porta fechada.",
    );

    void g.save();
    return true;
  }
  function sleep() {
    const bed = activeBed.value;
    if (
      !bed ||
      g.panel !== "sleep" ||
      g.paused ||
      g.state.mode !== "surface" ||
      bed.planetId !== g.planet.id ||
      Math.abs(bed.depth * 16 - (g.state.player.surfaceZ ?? 0)) > 24 ||
      !inReach(g.state.player, bed.x, bed.y, 76) ||
      pieceAt(settlement.value, bed.x, bed.y, bed.depth)?.piece.kind !== "bed"
    )
      return false;
    activeBed.value = undefined;
    g.sleepInBed();
    return true;
  }
  const activeFacility = ref<{ planetId: string; key: string }>();
  const facility = computed(() => {
    const active = activeFacility.value;
    if (!active || g.paused || g.busy || g.panel !== "facility" || active.planetId !== g.planet.id || (!facilityInReach(g.state, active.planetId, active.key) && !visitorInReach(g.state, active.planetId, active.key))) return;
    const piece = settlement.value.pieces[active.key]!;
    if (!isFacility(piece.kind)) return;
    return { key: active.key, atTerminal: facilityInReach(g.state, active.planetId, active.key), kind: piece.kind, piece, machine: machineAt(settlement.value, active.key)! };
  });
  function queueFacility(recipe: string, quantity: number) {
    const current = facility.value;
    if (!current?.atTerminal) return false;
    const error = enqueueFacility(settlement.value, current.key, recipe, quantity);
    if (error) { g.notify(error); return false; }
    void g.save(); return true;
  }
  function moveFacility(input: boolean, deposit: boolean, id: Item, quantity: number) {
    const current = facility.value;
    if (!current?.atTerminal || (!input && deposit) || (deposit && !facilityAccepts(current.kind, id))) return false;
    const inventory = input ? current.machine.input : current.machine.output;
    if (!transfer(deposit ? g.state.backpack : inventory, deposit ? inventory : g.state.backpack, id, quantity, deposit ? FACILITY_SLOTS : BACKPACK_SLOTS)) return false;
    current.machine.blocked = false;
    void g.save(); return true;
  }
  function openCargoVisitor() {
    const visitor = cargoVisitors(settlement.value).find(v => visitorInReach(g.state, g.planet.id, v.key));
    if (!visitor || g.paused || g.busy) return false;
    activeFacility.value = { planetId: g.planet.id, key: visitor.key };
    releaseControls(); g.panel = "facility"; return true;
  }
  function configureSale(id: Item, enabled: boolean) {
    const current = facility.value;
    if (!current?.atTerminal) return false;
    const error = setSaleItem(settlement.value, current.key, id, enabled);
    if (error) { g.notify(error); return false; }
    void g.save(); return true;
  }
  function buyCargoVisitor() {
    const current = facility.value;
    if (!current) return false;
    const error = purchaseVisitor(g.state, g.planet.id, current.key);
    if (error) { g.notify(error); return false; }
    g.notify(`Cargueiro comprado. Entrega no hangar de ${systemAt(g.state.seed, 0, 0).name}, setor 0, 0. Sua nave atual foi preservada.`);
    g.panel = ""; void g.save(); return true;
  }
  function answerBaseRequest(id: string, deliver: boolean) {
    const current = facility.value;
    if (!current?.atTerminal || current.kind !== "communicationsPost" || !current.piece.powered) return false;
    const error = respondRequest(g.state, g.planet, current.key, id, deliver);
    if (error) { g.notify(error); return false; }
    g.notify(deliver ? "Suprimentos entregues. Recompensa recebida." : "Pedido aceito. Traga os materiais na mochila.");
    void g.save(); return true;
  }
  function interactAt(x: number, y: number, depth = 0) {
    const found = pieceAt(settlement.value, x, y, depth);
    if (!found || Math.abs(depth * 16 - (g.state.player.surfaceZ ?? 0)) > 24) return false;
    if (isFacility(found.piece.kind)) {
      if (g.state.mode !== "surface" || !facilityInReach(g.state, g.planet.id, found.key)) return false;
      activeFacility.value = { planetId: g.planet.id, key: found.key };
      machineAt(settlement.value, found.key);
      releaseControls(); g.panel = "facility";
      return true;
    }
    if (found.piece.kind === "workbench") {
      g.openWorkbench(found.key);
      return true;
    }
    if (found.piece.kind === "bed") {
      if (
        g.state.mode === "surface" &&
        inReach(g.state.player, found.x, found.y, 76)
      ) {
        activeBed.value = { planetId: g.planet.id, x: found.x, y: found.y, depth };
        releaseControls();
        g.panel = "sleep";
      } else g.notify("Aproxime-se da cama para dormir.");
      return true;
    }
    if (found.piece.kind === "campfire") {
      if (
        g.state.mode === "surface" &&
        inReach(g.state.player, found.x, found.y, 76)
      ) {
        activeCampfire.value = {
          planetId: g.planet.id,
          x: found.x,
          y: found.y,
          depth,
        };
        releaseControls();
        g.panel = "cook";
      } else g.notify("Aproxime-se da fogueira para cozinhar.");
      return true;
    }
    if (found.piece.kind === "stickLadder") {
      if (
        g.state.mode === "surface" &&
        inReach(g.state.player, found.x, found.y, 28)
      ) {
        climbingColumn.value =
          climbingColumn.value === found.x ? undefined : found.x;
        if (climbingColumn.value !== undefined)
          g.notify(
            "Escada: use W/S, setas ou o controle vertical para subir e descer.",
          );
      }
      return true;
    }
    if (isOpening(found.piece.kind)) {
      toggleDoor(found.key);
      return true;
    }
    if (isCabinet(found.piece.kind)) {
      openCabinet(found.key);
      return true;
    }
    if (isBaseLight(found.piece.kind) && inReach(g.state.player, found.x, found.y, 76)) {
      g.refreshHabitat();
      g.notify(found.piece.kind === "floodlight"
        ? found.piece.powered ? "Holofote ligado · Alimentação solar ou bateria próxima." : "Holofote sem energia · Conecte uma placa exposta ou bateria a até 12 blocos."
        : `Emergência: ${found.piece.emergencyActive ? "sinalização acesa" : found.piece.powered ? "rede ativa, carregando reserva" : "sem carga"} · Reserva ${Math.floor(100 * (found.piece.backupEnergy ?? 0) / EMERGENCY_CAPACITY)}%.`);
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
    if (["oxygenGenerator", "planetaryOxygenGenerator"].includes(found.piece.kind) && inReach(g.state.player, found.x, found.y, 76)) {
      g.refreshHabitat();
      activeOxygenGenerator.value = { planetId: g.planet.id, x: found.x, y: found.y, depth };
      releaseControls();
      g.panel = "oxygen-cartridges";
      return true;
    }
    return false;
  }
  const activeOxygenGenerator = ref<{ planetId: string; x: number; y: number; depth: number }>();
  const oxygenGeneratorPiece = computed(() => {
    const target = activeOxygenGenerator.value;
    if (!target || g.state.mode !== "surface" || target.planetId !== g.planet.id ||
      Math.abs(target.depth * 16 - (g.state.player.surfaceZ ?? 0)) > 24 || !inReach(g.state.player, target.x, target.y, 76)) return;
    return pieceAt(settlement.value, target.x, target.y, target.depth);
  });
  const oxygenFillingElapsed = ref<number | null>(null);
  let oxygenFillingTimer: ReturnType<typeof setInterval> | undefined;
  function stopOxygenFilling() {
    clearInterval(oxygenFillingTimer);
    oxygenFillingTimer = undefined;
    oxygenFillingElapsed.value = null;
  }
  watch([() => g.panel, () => g.paused, () => g.state, activeOxygenGenerator], stopOxygenFilling, { flush: "sync" });
  onScopeDispose(stopOxygenFilling);
  function oxygenFillingResources() {
    if (g.paused || g.panel !== "oxygen-cartridges") return;
    const found = oxygenGeneratorPiece.value;
    if (!found) return;
    const network = powerNetwork(terrain.value, settlement.value);
    const batteryKey = network.planetary.find(generator => generator.key === found.key)?.battery;
    return { found, battery: batteryKey ? settlement.value.pieces[batteryKey] : undefined };
  }
  function fillOxygenCartridge() {
    if (oxygenFillingProgress(oxygenFillingElapsed.value)) return;
    stopOxygenFilling();
    g.refreshHabitat();
    const resources = oxygenFillingResources();
    if (!resources) { g.notify("Aproxime-se do gerador."); return; }
    const { found, battery } = resources;
    if (!fillCartridge({ ...g.state.backpack }, BACKPACK_SLOTS, { ...found.piece }, battery ? { ...battery } : undefined)) {
      g.notify("Leve um cartucho vazio na mochila e libere espaço. O gerador normal precisa de 100 O₂; o planetário deve estar ativo e ter 10 de energia na bateria.");
      return;
    }
    const startedAt = performance.now();
    oxygenFillingElapsed.value = 0;
    oxygenFillingTimer = setInterval(() => {
      const current = oxygenFillingResources();
      if (!current || current.found.piece !== found.piece) { stopOxygenFilling(); return; }
      oxygenFillingElapsed.value = Math.min(OXYGEN_FILL_TIME_MS, performance.now() - startedAt);
      if (oxygenFillingElapsed.value < OXYGEN_FILL_TIME_MS) return;
      stopOxygenFilling();
      g.refreshHabitat();
      const final = oxygenFillingResources();
      if (!final || !fillCartridge(g.state.backpack, BACKPACK_SLOTS, final.found.piece, final.battery)) {
        g.notify("Abastecimento cancelado: verifique os cartuchos, o espaço e os recursos do gerador.");
        return;
      }
      g.notify("Cartucho cheio. Guarde-o no reabastecedor do traje.");
      audio.play(520);
      void g.save();
    }, 100);
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
      Math.abs(fire.depth * 16 - (g.state.player.surfaceZ ?? 0)) <= 24 &&
      inReach(g.state.player, fire.x, fire.y, 76) &&
      pieceAt(settlement.value, fire.x, fire.y, fire.depth)?.piece.kind === "campfire"
    );
  }
  function cookMeat() {
    if (cookingElapsed.value !== null) return;
    if (!canCook()) {
      g.notify("Aproxime-se de uma fogueira instalada.");
      return;
    }
    g.refreshFood();
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
        !isFacility(piece.kind) && !isCabinet(piece.kind) &&
        ![
          "airlockDoor",
          "woodDoor",
          "woodHatch",
          "fenceGate",
          "stickLadder",
          "campfire",
          "bed",
          "workbench",
          "floodlight",
          "emergencyLight",
          "battery",
          "oxygenGenerator",
          "planetaryOxygenGenerator",
        ].includes(piece.kind)
      )
        continue;
      const [x, y, depth = 0] = id.split(",").map(Number);
      const depthDistance = depth * 16 - (g.state.player.surfaceZ ?? 0);
      if (Math.abs(depthDistance) > 24) continue;
      const d = Math.hypot(
          x! * 16 +
            pieceWidth(piece.kind) * 8 -
            g.state.player.x,
          depthDistance,
          y! * 16 + (isDoor(piece.kind) ? 0 : 8) - g.state.player.y,
        );
      if (piece.kind === "woodHatch" && climbingColumn.value === x && d < 32)
        return { key: id, distance: d };
      if (d < distance && (piece.kind !== "stickLadder" || d <= 28)) {
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
    const fridge = containerKind.value === "fridge";
    if (fridge && direction === "deposit" && id !== "rawMeat") {
      g.notify("A geladeira armazena somente carne crua.");
      return false;
    }
    g.refreshFood();
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
        fridge
          ? { time: g.state.time, deposit: direction === "deposit" }
          : undefined,
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
  function setCursor(x: number, y: number, depth = 0) {
    if (cursor.value?.x !== x || cursor.value?.y !== y || cursor.value?.depth !== depth) lastError.value = "";
    cursor.value = { x, y, depth };
  }
  function cabinetAt(x: number, y: number) {
    return isCabinet(pieceAt(settlement.value, x, y)?.piece.kind);
  }
  watch(
    () => assignableQuickSlots.filter((slot) => {
      const item = g.state.quickSlots?.[slot];
      return item && (g.state.backpack[item] ?? 0) <= 0;
    }),
    (emptySlots) => {
      if (!emptySlots.length) return;
      const slots = { ...g.state.quickSlots };
      for (const slot of emptySlots) {
        const item = slots[slot];
        if (enabled.value && !removing.value && item === selectedItem.value) disable();
        if (item && item === g.state.player.photonSaber) g.state.player.photonSaber = undefined;
        delete slots[slot];
      }
      g.state.quickSlots = slots;
    },
    { immediate: true, flush: "sync" },
  );
  watch(
    () => [g.state, g.state.mode, g.planet.id, g.state.backpack.bucket, g.equippedSaber],
    () => {
      if (g.state.mode !== "surface" || !g.state.backpack.bucket || g.equippedSaber)
        holdingBucket.value = false;
      if (g.state.mode !== "surface") {
        enabled.value = false;
        cursor.value = null;
        activeCabinet.value = null;
        climbingColumn.value = undefined;
      }
    },
    { flush: "sync" },
  );
  return {
    oxygenFillingElapsed,
    oxygenGeneratorPiece,
    fillOxygenCartridge,
    enabled,
    lastError,
    removing,
    selected,
    selectedItem,
    selectedMaterial,
    bucketEquipped,
    activeQuickSlot,
    assignQuickSlot,
    activateQuickSlot,
    facing,
    rotation,
    canRotate,
    cursor,
    settlement,
    terrain,
    container,
    containerKind,
    containerCapacity,
    fridgePowered,
    climbingColumn,
    activeCabinet,
    selectedCount,
    openPalette,
    equip,
    disable,
    rotate,
    errorAt,
    apply,
    facility, queueFacility, moveFacility, openCargoVisitor, configureSale, buyCargoVisitor, answerBaseRequest,
    harvest,
    collectWoodDrops,
    collectFruit,
    waterPlant,
    openCabinet,
    nearestInteraction,
    toggleDoor,
    interactAt,
    sleep,
    cookMeat,
    cookingElapsed,
    moveItem,
    setCursor,
    cabinetAt,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConstruction, import.meta.hot));
}
