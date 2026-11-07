import type {
  BuildItem,
  Inventory,
  Item,
  Save,
  Settlement,
} from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { keyAt, pieceAt, footprint, overlapsActor } from "./pieces";
export { keyAt } from "./pieces";
import { add, consume, slots } from "../inventory/inventory";
export const buildItems: BuildItem[] = [
  "woodBlock",
  "woodWall",
  "woodStairs",
  "cabinet",
  "woodDoor",
  "solarPanel",
  "battery",
  "oxygenGenerator",
];
export const CABINET_SLOTS = 16,
  BUILD_RANGE = 96;
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
  player: { x: number; y: number };
  landingX: number;
}
export function placementError(
  ctx: BuildContext,
  kind: BuildItem,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
): string | undefined {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    Math.abs(x) > 1e9 ||
    y < 1 ||
    y >= 63
  )
    return "Local fora dos limites de construção.";
  if (!inReach(ctx.player, x, y))
    return "Aproxime-se: alcance de construção de 6 blocos.";
  const { terrain, settlement } = ctx;
  const cells = footprint(kind, x, y);
  for (const cell of cells) {
    if (cell.y < 1) return "A porta precisa de dois blocos livres de altura.";
    if (terrain.get(cell.x, cell.y) !== 0)
      return kind === "woodDoor"
        ? "Abra um vão de 1 × 2 blocos para instalar a porta."
        : "Minere o terreno antes de construir aqui.";
    if (
      kind === "woodWall"
        ? settlement.walls[keyAt(cell.x, cell.y)]
        : pieceAt(settlement, cell.x, cell.y)
    )
      return "Já existe uma peça nesta camada.";
  }
  if (
    (kind === "woodBlock" || kind === "woodDoor") &&
    overlapsActor(kind, x, y, ctx.player)
  )
    return "Não é possível fechar uma peça sobre o astronauta.";
  const padY = terrain.height(ctx.landingX) * 16;
  for (const cell of cells) {
    if (
      kind !== "woodWall" &&
      cell.x * 16 < ctx.landingX * 16 + 27 &&
      (cell.x + 1) * 16 > ctx.landingX * 16 - 27 &&
      cell.y * 16 < padY &&
      (cell.y + 1) * 16 > padY - 32
    )
      return "Mantenha a área de acesso da nave livre.";
    if (
      ["woodBlock", "woodStairs", "woodDoor"].includes(kind) &&
      cell.x * 16 < ctx.landingX * 16 + 48 &&
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
      terrain.get(nx!, ny!) !== 0 ||
      !!pieceAt(settlement, nx!, ny!) ||
      !!settlement.walls[keyAt(nx!, ny!)],
  );
  const lowerStair = settlement.pieces[keyAt(x - facing, y + 1)];
  const stairSupport =
    kind === "woodStairs" &&
    lowerStair?.kind === "woodStairs" &&
    lowerStair.facing === facing;
  if (!supported && !stairSupport)
    return "Conecte a peça ao terreno ou a uma construção existente.";
  if (
    [
      "cabinet",
      "woodDoor",
      "solarPanel",
      "battery",
      "oxygenGenerator",
    ].includes(kind) &&
    !(
      terrain.get(x, y + 1) ||
      settlement.pieces[keyAt(x, y + 1)]?.kind === "woodBlock"
    )
  )
    return "Esta peça precisa de chão firme logo abaixo.";
  if ((ctx.inventory[kind] ?? 0) < 1)
    return "Fabrique mais peças de construção.";
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
  const key = keyAt(x, y);
  if (kind === "woodWall") ctx.settlement.walls[key] = true;
  else {
    ctx.settlement.pieces[key] = {
      kind,
      facing,
      ...(kind === "woodDoor" ? { open: false } : {}),
      ...(kind === "battery" ? { energy: 0 } : {}),
      ...(kind === "oxygenGenerator" ? { energy: 0, oxygen: 0 } : {}),
    };
    if (kind === "cabinet") ctx.settlement.cabinets[key] = {};
  }
}
export function removePiece(
  ctx: BuildContext,
  x: number,
  y: number,
  wallLayer = false,
) {
  if (!inReach(ctx.player, x, y)) return "Aproxime-se para desmontar.";
  const located = pieceAt(ctx.settlement, x, y),
    key = wallLayer ? keyAt(x, y) : (located?.key ?? keyAt(x, y));
  const kind = wallLayer
    ? ctx.settlement.walls[key]
      ? "woodWall"
      : undefined
    : located?.piece.kind;
  if (!kind)
    return "Nenhuma peça nesta camada. Escolha Parede para desmontar o fundo.";
  if (kind === "cabinet" && slots(ctx.settlement.cabinets[key] ?? {}) > 0)
    return "Esvazie o armário antes de desmontá-lo.";
  if (!add(ctx.inventory, kind, 1, ctx.capacity))
    return "Carga cheia: não há espaço para recuperar a peça.";
  if (wallLayer) delete ctx.settlement.walls[key];
  else {
    delete ctx.settlement.pieces[key];
    delete ctx.settlement.cabinets[key];
  }
}
/** Both inventories change together, or neither changes. */
export function transfer(
  source: Inventory,
  destination: Inventory,
  id: Item,
  quantity: number,
  capacity: number,
) {
  if (source === destination || !Number.isInteger(quantity) || quantity < 1)
    return false;
  const from = { ...source },
    to = { ...destination };
  if (!consume(from, { [id]: quantity }) || !add(to, id, quantity, capacity))
    return false;
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
  for (const [id, n] of Object.entries(resources))
    if (!add(draft, id as Item, n!, capacity)) return false;
  for (const id of Object.keys(inventory)) delete inventory[id as Item];
  Object.assign(inventory, draft);
  return true;
}
