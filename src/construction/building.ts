import { facilityDefinitions, isFacility, type FacilityKind } from "./facilityTypes";
import type {
  BuildItem,
  Inventory,
  Item,
  Save,
  Settlement,
} from "../game/types";
import { isLiquidTile, isSolidTile, type Terrain } from "../game/procedural/terrain";
import {
  cabinetWidths,
  isCabinet,
  isOpening,
  isDoor,
  isWall,
  keyAt,
  pieceAt,
  footprint,
  overlapsActor,
  type CabinetKind,
} from "./pieces";
export { keyAt } from "./pieces";
import { add, consume, inventoryEntries, slots } from "../inventory/inventory";
import { addMeatBatches, splitMeat } from "../survival/perishables";
export const buildItems: BuildItem[] = [
  ...Object.keys(facilityDefinitions) as FacilityKind[],
  "woodBlock",
  "cropRoof",
  "woodFence",
  "fenceGate",
  "woodWall",
  "stoneWall",
  "metalWall",
  "fridge",
  "picture",
  "table",
  "bed",
  "woodStairs",
  "stickLadder",
  "woodHatch",
  "cabinet",
  "cabinetDouble",
  "cabinetTriple",
  "workbench",
  "floodlight",
  "emergencyLight",
  "window",
  "airlockDoor",
  "woodDoor",
  "solarPanel",
  "campfire",
  "battery",
  "oxygenGenerator",
  "planetaryOxygenGenerator",
];
export const CABINET_SLOTS = 16,
  BUILD_RANGE = 96;
export function cabinetCapacity(kind: CabinetKind) {
  return CABINET_SLOTS * cabinetWidths[kind];
}
export function emptySettlement(): Settlement {
  return { pieces: {}, walls: {}, cabinets: {}, cutTrees: [] };
}
export function settlementFor(state: Save, planetId: string) {
  if (!state.settlements[planetId])
    state.settlements[planetId] = emptySettlement();
  return state.settlements[planetId]!;
}
export function isBuildItem(item: Item): item is BuildItem {
  return buildItems.includes(item as BuildItem);
}
export function inReach(
  player: { x: number; y: number },
  x: number,
  y: number,
  range = BUILD_RANGE,
) {
  return Math.hypot(x * 16 + 8 - player.x, y * 16 + 8 - player.y) <= range;
}
export interface BuildContext {
  terrain: Terrain;
  settlement: Settlement;
  inventory: Inventory;
  capacity: number;
  player: { x: number; y: number; surfaceZ?: number };
  depth?: number;
  rotation?: number;
  landingX: number;
}
export function placementError(
  ctx: BuildContext,
  kind: BuildItem,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
  material?: Item,
): string | undefined {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    Math.abs(x) > 1e9 ||
    y < 1 ||
    y >= 63
  )
    return "Local fora dos limites de construção.";
  if (Math.hypot(x * 16 + 8 - ctx.player.x, y * 16 + 8 - ctx.player.y, (ctx.depth ?? 0) * 16 - (ctx.depth === undefined ? 0 : ctx.player.surfaceZ ?? 0)) > BUILD_RANGE)
    return "Aproxime-se: alcance de construção de 6 blocos.";
  const { terrain, settlement } = ctx;
  const depth = ctx.depth ?? 0;
  const walls = depth ? settlement.depthWalls : settlement.walls;
  const hasGround = (x: number, y: number) =>
    isSolidTile(terrain.getAt(x, y, depth)) || settlement.depthBlocks?.[keyAt(x, y, depth)];
  const cells = footprint(kind, x, y);
  for (const cell of cells) {
    if (cell.y < 1) return "A porta precisa de dois blocos livres de altura.";
    if (isLiquidTile(terrain.getAt(cell.x, cell.y, depth)))
      return "Não é possível construir dentro de água ou lava.";
    if (hasGround(cell.x, cell.y))
      return isDoor(kind)
        ? "Abra um vão de 1 × 2 blocos para instalar a porta."
        : "Minere o terreno antes de construir aqui.";
    const key = keyAt(cell.x, cell.y, depth);
    if (settlement.crops?.[key]) return "Já existe um cultivo nesta célula.";
    if (material && (walls?.[key] || settlement.cornerWalls?.[key]))
      return "Já existe uma parede nesta célula.";
    const occupant = pieceAt(settlement, cell.x, cell.y, depth)?.piece;
    if ((kind === "window" && (walls?.[key] || settlement.cornerWalls?.[key])) ||
        (isWall(kind) && occupant?.kind === "window"))
      return "A janela precisa de um vão livre, sem parede ou bloco de madeira.";
    if (kind === "airlockDoor" && (walls?.[key] || settlement.cornerWalls?.[key]))
      return "Abra um vão sem parede para instalar a porta da antecâmara.";
    const rotation = ctx.rotation;
    const wallOccupied = walls?.[key] && (
      rotation === undefined ||
      (settlement.wallRotations?.[key] ?? 0) === rotation ||
      settlement.cornerWalls?.[key]?.[rotation]
    );
    if (isWall(kind) ? wallOccupied : pieceAt(settlement, cell.x, cell.y, depth))
      return "Já existe uma peça nesta camada.";
  }
  if (
    (isFacility(kind) || kind === "workbench" || kind === "woodBlock" || kind === "cropRoof" ||
      kind === "woodFence" || kind === "window" || isOpening(kind) || (ctx.depth !== undefined && isWall(kind))) &&
    (ctx.depth === undefined || Math.abs(depth * 16 - (ctx.player.surfaceZ ?? 0)) < 12) &&
    overlapsActor(kind, x, y, ctx.player)
  )
    return "Não é possível fechar uma peça sobre o astronauta.";
  const padY = terrain.height(ctx.landingX) * 16;
  for (const cell of cells) {
    if (
      !isWall(kind) &&
      depth === 0 && cell.x * 16 < ctx.landingX * 16 + 27 &&
      (cell.x + 1) * 16 > ctx.landingX * 16 - 27 &&
      cell.y * 16 < padY &&
      (cell.y + 1) * 16 > padY - 32
    )
      return "Mantenha a área de acesso da nave livre.";
    if (
      (kind === "woodBlock" || kind === "woodStairs" || kind === "woodFence" || isOpening(kind)) &&
      depth === 0 && cell.x * 16 < ctx.landingX * 16 + 48 &&
      (cell.x + 1) * 16 > ctx.landingX * 16 + 32 &&
      cell.y * 16 < padY &&
      (cell.y + 1) * 16 > padY - 32
    )
      return "Mantenha a saída do astronauta livre ao lado da nave.";
  }
  const supported = [
    [x, y + 1],
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
  ].some(
    ([nx, ny]) =>
      hasGround(nx!, ny!) ||
      !!pieceAt(settlement, nx!, ny!, depth) ||
      !!walls?.[keyAt(nx!, ny!, depth)],
  );
  const depthSupport = ctx.depth !== undefined && [-1, 1].some((offset) => {
    const neighbor = depth + offset;
    const key = keyAt(x, y, neighbor);
    return isSolidTile(terrain.getAt(x, y, neighbor)) || settlement.depthBlocks?.[key] ||
      pieceAt(settlement, x, y, neighbor) ||
      (neighbor ? settlement.depthWalls : settlement.walls)?.[key];
  });
  const lowerStair = settlement.pieces[keyAt(x - facing, y + 1, depth)];
  const stairSupport =
    kind === "woodStairs" &&
    lowerStair?.kind === "woodStairs" &&
    lowerStair.facing === facing;
  const ladderBacking = kind === "stickLadder" && walls?.[keyAt(x, y, depth)];
  const wallBacking = (kind === "picture" || kind === "emergencyLight") && walls?.[keyAt(x, y, depth)];
  const post = kind === "cropRoof" && pieceAt(settlement, x, y + 2, depth)?.piece.kind;
  const roofSupport = post === "woodFence" || post === "fenceGate" || post === "woodBlock";
  if (kind === "picture" && !wallBacking)
    return "Instale o quadro sobre uma parede de fundo.";
  if (!(isWall(kind) && ctx.rotation !== undefined && walls?.[keyAt(x, y, depth)]) && !supported && !depthSupport && !stairSupport && !ladderBacking && !wallBacking && !roofSupport)
    return "Conecte a peça ao terreno ou a uma construção existente.";
  if (
    (isFacility(kind) || isCabinet(kind) ||
      [
        "workbench",
        "floodlight",
        "campfire",
        "table",
        "bed",
        "airlockDoor",
        "woodDoor",
        "woodFence",
        "fenceGate",
        "solarPanel",
        "battery",
        "oxygenGenerator",
        "planetaryOxygenGenerator",
      ].includes(kind)) &&
    !cells
      .filter((cell) => cell.y === y)
      .every(
        (cell) =>
          hasGround(cell.x, y + 1) ||
          settlement.pieces[keyAt(cell.x, y + 1, depth)]?.kind === "woodBlock",
      )
  )
    return "Esta peça precisa de chão firme logo abaixo.";
  if ((ctx.inventory[material ?? kind] ?? 0) < 1)
    return material ? "Material indisponível na mochila." : "Fabrique mais peças de construção.";
  return undefined;
}
export function placePiece(
  ctx: BuildContext,
  kind: BuildItem,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
) {
  const error = placementError(ctx, kind, x, y, facing);
  if (error) return error;
  if (!consume(ctx.inventory, { [kind]: 1 })) return "Peça indisponível.";
  const key = keyAt(x, y, ctx.depth);
  if (isWall(kind)) {
    const walls = ctx.depth ? (ctx.settlement.depthWalls ??= {}) : ctx.settlement.walls;
    const material = kind === "woodWall" ? true : kind;
    if (walls[key] && ctx.rotation !== undefined) {
      const corners = (ctx.settlement.cornerWalls ??= {});
      (corners[key] ??= {})[ctx.rotation] = material;
    } else {
      walls[key] = material;
      if (ctx.rotation !== undefined) (ctx.settlement.wallRotations ??= {})[key] = ctx.rotation;
    }
  }
  else {
    ctx.settlement.pieces[key] = {
      kind,
      facing,
      ...(ctx.rotation !== undefined ? { rotation: ctx.rotation } : {}),
      ...(isOpening(kind) ? { open: false } : {}),
      ...(kind === "battery" ? { energy: 0 } : {}),
      ...(kind === "emergencyLight" ? { backupEnergy: 0, powered: false, emergencyActive: false } : {}),
      ...(kind === "floodlight" ? { powered: false } : {}),
      ...(kind === "oxygenGenerator" ? { energy: 0, oxygen: 0 } : {}),
    };
    if (isCabinet(kind)) ctx.settlement.cabinets[key] = {};
  }
}
export function removePiece(
  ctx: BuildContext,
  x: number,
  y: number,
  wallLayer = false,
  wallFace?: number,
) {
  if (Math.hypot(x * 16 + 8 - ctx.player.x, y * 16 + 8 - ctx.player.y, (ctx.depth ?? 0) * 16 - (ctx.depth === undefined ? 0 : ctx.player.surfaceZ ?? 0)) > BUILD_RANGE) return "Aproxime-se para desmontar.";
  const walls = ctx.depth ? ctx.settlement.depthWalls : ctx.settlement.walls;
  const located = pieceAt(ctx.settlement, x, y, ctx.depth),
    key = wallLayer ? keyAt(x, y, ctx.depth) : (located?.key ?? keyAt(x, y, ctx.depth));
  const primaryFace = ctx.settlement.wallRotations?.[key] ?? 0;
  const corners = ctx.settlement.cornerWalls?.[key];
  const extraFace = wallFace !== undefined && wallFace !== primaryFace ? wallFace : undefined;
  const wall = extraFace === undefined ? walls?.[key] : corners?.[extraFace];
  const kind = wallLayer
    ? wall === true
      ? "woodWall"
      : wall
    : located?.piece.kind;
  if (!kind)
    return "Nenhuma peça nesta camada. Escolha Parede para desmontar o fundo.";
  if (isFacility(kind)) {
    const machine = ctx.settlement.machines?.[key];
    if (machine?.trade?.visitor) return "Aguarde o cargueiro partir antes de desmontar o entreposto.";
    if (machine && (machine.queue.length || slots(machine.input) || slots(machine.output)))
      return "Esvazie os reservatórios e conclua a fila antes de desmontar a instalação.";
  }
  if (isCabinet(kind) && slots(ctx.settlement.cabinets[key] ?? {}) > 0)
    return "Esvazie o armário antes de desmontá-lo.";
  if (wallLayer && located?.piece.kind === "picture")
    return "Retire o quadro antes de desmontar esta parede.";
  if (!add(ctx.inventory, kind, 1, ctx.capacity))
    return "Carga cheia: não há espaço para recuperar a peça.";
  if (wallLayer && walls) {
    if (extraFace !== undefined && corners) delete corners[extraFace];
    else {
      const replacement = Object.entries(corners ?? {})[0];
      if (replacement && corners) {
        const [face, material] = replacement;
        walls[key] = material;
        (ctx.settlement.wallRotations ??= {})[key] = Number(face);
        delete corners[face];
      } else {
        delete walls[key];
        if (ctx.settlement.wallRotations) delete ctx.settlement.wallRotations[key];
      }
    }
    if (corners && !Object.keys(corners).length) delete ctx.settlement.cornerWalls?.[key];
  }
  else {
    delete ctx.settlement.pieces[key];
    delete ctx.settlement.cabinets[key];
    if (ctx.settlement.machines) delete ctx.settlement.machines[key];
  }
}
/** Both inventories change together, or neither changes. */
export function transfer(
  source: Inventory,
  destination: Inventory,
  id: Item,
  quantity: number,
  capacity: number,
  cooling?: { time: number; deposit: boolean },
) {
  if (source === destination || !Number.isInteger(quantity) || quantity < 1)
    return false;
  const from = { ...source },
    to = { ...destination };
  if (!consume(from, { [id]: quantity }) || !add(to, id, quantity, capacity))
    return false;
  if (id === "rawMeat") {
    const { taken } = splitMeat(source, quantity);
    addMeatBatches(
      to,
      cooling
        ? taken.map((batch) => ({
            ...batch,
            expires:
              batch.expires + (cooling.deposit ? -cooling.time : cooling.time),
          }))
        : taken,
    );
  }
  for (const key of Object.keys(source)) delete source[key as Item];
  Object.assign(source, from);
  for (const key of Object.keys(destination)) delete destination[key as Item];
  Object.assign(destination, to);
  return true;
}
export function addBatch(
  inventory: Inventory,
  resources: Inventory,
  capacity: number,
) {
  const draft = { ...inventory };
  for (const [id, n] of inventoryEntries(resources))
    if (!add(draft, id as Item, n!, capacity)) return false;
  Object.assign(inventory, draft);
  return true;
}
