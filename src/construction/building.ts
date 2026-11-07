import type {
  BuildItem,
  Inventory,
  Item,
  Save,
  Settlement,
} from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { add, consume, slots } from "../inventory/inventory";
export const buildItems: BuildItem[] = [
  "woodBlock",
  "woodWall",
  "woodStairs",
  "cabinet",
];
export const CABINET_SLOTS = 16,
  BUILD_RANGE = 96;
export const keyAt = (x: number, y: number) => `${x},${y}`;
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
  const key = keyAt(x, y),
    { terrain, settlement } = ctx;
  if (terrain.get(x, y) !== 0)
    return "Minere o terreno antes de construir aqui.";
  if (kind === "woodWall" ? settlement.walls[key] : settlement.pieces[key])
    return "Já existe uma peça nesta camada.";
  if (
    kind === "woodBlock" &&
    Math.abs(x * 16 + 8 - ctx.player.x) < 13 &&
    Math.abs(y * 16 + 8 - ctx.player.y) < 20
  )
    return "Não é possível fechar um bloco sobre o astronauta.";
  const padY = terrain.height(ctx.landingX) * 16;
  if (
    kind !== "woodWall" &&
    x * 16 < ctx.landingX * 16 + 27 &&
    (x + 1) * 16 > ctx.landingX * 16 - 27 &&
    y * 16 < padY &&
    (y + 1) * 16 > padY - 32
  )
    return "Mantenha a área de acesso da nave livre.";
  if (
    (kind === "woodBlock" || kind === "woodStairs") &&
    x * 16 < ctx.landingX * 16 + 48 &&
    (x + 1) * 16 > ctx.landingX * 16 + 32 &&
    y * 16 < padY &&
    (y + 1) * 16 > padY - 32
  )
    return "Mantenha a saída do astronauta livre ao lado da nave.";
  const supported = [
    [x, y + 1],
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
  ].some(
    ([nx, ny]) =>
      terrain.get(nx!, ny!) !== 0 ||
      !!settlement.pieces[keyAt(nx!, ny!)] ||
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
    kind === "cabinet" &&
    !(
      terrain.get(x, y + 1) ||
      settlement.pieces[keyAt(x, y + 1)]?.kind === "woodBlock"
    )
  )
    return "O armário precisa de chão firme logo abaixo.";
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
    ctx.settlement.pieces[key] = { kind, facing };
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
  const key = keyAt(x, y),
    kind = wallLayer
      ? ctx.settlement.walls[key]
        ? "woodWall"
        : undefined
      : ctx.settlement.pieces[key]?.kind;
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
