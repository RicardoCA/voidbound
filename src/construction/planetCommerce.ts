import {
  items,
  type Inventory,
  type Item,
  type Planet,
  type Save,
  type Settlement,
  type ShipModelId,
} from "../game/types";
import { hash } from "../game/procedural/random";
import { Terrain } from "../game/procedural/terrain";
import { spatialTreesNear, treesInRange } from "../game/procedural/trees";
import { consume, inventoryEntries } from "../inventory/inventory";
import { marketItems, marketPrice, type MarketItem } from "../economy/market";
import { registerShip } from "../fleet/hangar";
import { shipModels } from "../fleet/models";
import { civilizationOf, civicAid } from "../diplomacy/governance";
import { systemAt } from "../universe/generator";
import { pieceAt } from "./pieces";

export const TRADE_INTERVAL = 180;
export const ARRIVAL_SECONDS = 12;
export const LANDED_SECONDS = 60;
export const DEPARTURE_SECONDS = 12;
export const REQUEST_INTERVAL = 300;
export const REQUEST_LIFETIME = 900;
export interface CargoVisit {
  id: string;
  model: ShipModelId;
  phase: "arriving" | "landed" | "departing";
  elapsed: number;
  x: number;
  y: number;
  z: number;
  traded: boolean;
  bought?: boolean;
  receipt?: string;
}
export interface TradingState {
  enabled: Partial<Record<MarketItem, boolean>>;
  wait: number;
  serial: number;
  visitor?: CargoVisit;
  history: { id: string; credits: number; text: string }[];
}
export type RequestKind = keyof typeof civicAid | "freight";
export interface BaseRequest {
  id: string;
  kind: RequestKind;
  title: string;
  cost: Inventory;
  reward: number;
  influence: number;
  expires: number;
  status: "available" | "accepted" | "completed";
}
export interface CommunicationsState {
  requests: BaseRequest[];
  cycle?: number;
  messages: string[];
}
export function tradingState(data: Settlement, key: string) {
  const machine = data.machines?.[key];
  if (data.pieces[key]?.kind !== "tradingPost" || !machine) return;
  return (machine.trade ??= { enabled: {}, wait: 0, serial: 0, history: [] });
}
export function communicationsState(data: Settlement, key: string) {
  const machine = data.machines?.[key];
  if (data.pieces[key]?.kind !== "communicationsPost" || !machine) return;
  return (machine.communications ??= { requests: [], messages: [] });
}
export function setSaleItem(
  data: Settlement,
  key: string,
  item: Item,
  enabled: boolean,
) {
  const trade = tradingState(data, key);
  if (!trade || !marketItems.includes(item as MarketItem))
    return "Recurso não comercializável.";
  trade.enabled[item as MarketItem] = enabled;
}

/** Find a real patch of terrain away from the terminal, player ship, trees and buildings. */
export function cargoLandingSite(
  state: Save,
  planet: Planet,
  terrain: Terrain,
  key: string,
) {
  const data = state.settlements[planet.id]!;
  const [cx = 0, , cz = 0] = key.split(",").map(Number);
  for (const depth of [0, 12, -12, 18, -18, 26, -26, 36, -36])
    for (const offset of [12, -12, 18, -18, 26, -26, 36, -36]) {
      const x = cx + offset,
        z = cz + depth;
      if (Math.abs(x - state.landingX) < 12 && Math.abs(z) < 12) continue;
      if (
        cargoVisitors(data).some(
          (v) => Math.hypot(v.x - (x * 16 + 8), v.z - z * 16) < 230,
        )
      )
        continue;
      const y = terrain.heightAt(x, z);
      if (y < 3 || y > 59) continue;
      let clear = true,
        top = y;
      for (let dx = -5; dx <= 5 && clear; dx++)
        for (let dz = -4; dz <= 4 && clear; dz++) {
          top = Math.min(top, terrain.heightAt(x + dx, z + dz));
          if (Math.abs(terrain.heightAt(x + dx, z + dz) - y) > 6) {
            clear = false;
            break;
          }
          for (let dy = -9; dy <= 4; dy++) {
            const id =
              z + dz ? `${x + dx},${y + dy},${z + dz}` : `${x + dx},${y + dy}`;
            if (
              pieceAt(data, x + dx, y + dy, z + dz) ||
              data.walls[id] ||
              data.depthWalls?.[id] ||
              data.depthBlocks?.[id]
            ) {
              clear = false;
              break;
            }
          }
        }
      if (!clear) continue;
      if (
        [
          ...spatialTreesNear(terrain, x * 16, z * 16, data.cutTrees),
          ...treesInRange(planet, terrain, x - 8, x + 8, data.cutTrees),
        ].some(
          (tree) =>
            Math.abs(tree.x - x) < 8 && Math.abs((tree.depth ?? 0) - z) < 6,
        )
      )
        continue;
      return { x: x * 16 + 8, y: top * 16, z: z * 16 };
    }
}
export function sellToVisitor(state: Save, planetId: string, key: string) {
  const data = state.settlements[planetId];
  if (!data) return;
  const trade = tradingState(data, key),
    visitor = trade?.visitor;
  if (!trade || !visitor || visitor.phase !== "landed" || visitor.traded)
    return;
  const input = data.machines![key]!.input;
  const cargo: Inventory = { ...input };
  let budget = 6000,
    credits = 0,
    remaining = 80;
  const sold: string[] = [];
  for (const item of marketItems) {
    if (!trade.enabled[item]) continue;
    const price = marketPrice(item, "sell");
    const count = Math.min(
      cargo[item] ?? 0,
      remaining,
      Math.floor(budget / price),
    );
    if (!Number.isSafeInteger(count) || count < 1) continue;
    if (!consume(cargo, { [item]: count })) return;
    credits += count * price;
    budget -= count * price;
    remaining -= count;
    sold.push(`${count} ${items[item].name}`);
  }
  const balance = state.credits + credits;
  if (!Number.isSafeInteger(balance) || balance < 0) return;
  // Commit all sale mutations together; replaying the landing cannot pay twice.
  data.machines![key]!.input = cargo;
  state.credits = balance;
  visitor.traded = true;
  visitor.receipt = credits
    ? `Compra concluída: +${credits} CR (${sold.join(", ")}).`
    : "Nenhum recurso autorizado disponível para compra.";
  trade.history.unshift({ id: visitor.id, credits, text: visitor.receipt });
  trade.history.length = Math.min(8, trade.history.length);
}
export function cargoVisitors(data?: Settlement) {
  return Object.entries(data?.machines ?? {}).flatMap(([key, machine]) => {
    const visitor = machine.trade?.visitor;
    return data?.pieces[key]?.kind === "tradingPost" && visitor
      ? [{ key, ...visitor }]
      : [];
  });
}
function onPlanet(state: Save, planetId: string) {
  return (
    state.mode === "surface" &&
    systemAt(state.seed, state.systemX, state.systemY).planets[
      state.planetIndex
    ]?.id === planetId
  );
}
export function visitorInReach(state: Save, planetId: string, key: string) {
  const visitor = state.settlements[planetId]?.machines?.[key]?.trade?.visitor;
  return (
    state.settlements[planetId]?.pieces[key]?.kind === "tradingPost" &&
    !!visitor &&
    !visitor.bought &&
    visitor.phase === "landed" &&
    onPlanet(state, planetId) &&
    Math.hypot(
      state.player.x - visitor.x,
      state.player.y - visitor.y + 12,
      (state.player.surfaceZ ?? 0) - visitor.z,
    ) < 155
  );
}
export function purchaseVisitor(state: Save, planetId: string, key: string) {
  if (!visitorInReach(state, planetId, key))
    return "Aproxime-se do cargueiro pousado.";
  const visitor = state.settlements[planetId]!.machines![key]!.trade!.visitor!;
  const model = shipModels[visitor.model];
  if (!Number.isSafeInteger(state.credits) || state.credits < model.price)
    return "Créditos insuficientes para comprar este cargueiro.";
  const error = registerShip(state, visitor.model);
  if (error) return error;
  state.credits -= model.price;
  visitor.bought = true;
  visitor.phase = "departing";
  visitor.elapsed = 0;
  // Deliver to an accessible hangar, including systems without a station.
  const ship = state.parkedShips.at(-1)!;
  ship.location = { x: 0, y: 0 };
  return undefined;
}
export function advanceTrading(
  state: Save,
  planet: Planet,
  terrain: Terrain,
  key: string,
  dt: number,
  powered: number,
) {
  const data = state.settlements[planet.id]!;
  const trade = tradingState(data, key)!;
  const visitor = trade.visitor;
  if (visitor) {
    // Flights use active time once dispatched, even if the terminal loses power.
    visitor.elapsed += dt;
    if (visitor.phase === "arriving" && visitor.elapsed >= ARRIVAL_SECONDS) {
      visitor.phase = "landed";
      visitor.elapsed = 0;
      sellToVisitor(state, planet.id, key);
    } else if (
      visitor.phase === "landed" &&
      visitor.elapsed >= LANDED_SECONDS
    ) {
      visitor.phase = "departing";
      visitor.elapsed = 0;
    } else if (
      visitor.phase === "departing" &&
      visitor.elapsed >= DEPARTURE_SECONDS
    ) {
      delete trade.visitor;
      trade.wait = 0;
    }
    return;
  }
  if (
    !marketItems.some(
      (item) =>
        trade.enabled[item] && (data.machines![key]!.input[item] ?? 0) > 0,
    )
  )
    return;
  trade.wait = Math.min(TRADE_INTERVAL, trade.wait + powered);
  if (trade.wait < TRADE_INTERVAL) return;
  const site = cargoLandingSite(state, planet, terrain, key);
  if (!site) {
    trade.wait = TRADE_INTERVAL - 30;
    data.machines![key]!.message =
      "Sem área livre para pouso. Libere terreno ao redor do entreposto.";
    return;
  }
  const models: ShipModelId[] = ["atlas", "caravan", "meridian"];
  const serial = trade.serial++;
  trade.visitor = {
    ...site,
    id: `${planet.id}:${key}:cargo:${serial}`,
    model: models[hash(`${planet.id}:${key}:${serial}`) % models.length]!,
    phase: "arriving",
    elapsed: 0,
    traded: false,
  };
  data.machines![key]!.message =
    "Cargueiro a caminho! Pousará em 12 segundos. Aproxime-se para conversar.";
}
export function advanceCommunications(
  state: Save,
  planet: Planet,
  key: string,
  powered: number,
) {
  if (!powered) return;
  const data = state.settlements[planet.id]!;
  const comms = communicationsState(data, key)!;
  const now = state.activePlayTime ?? 0,
    cycle = Math.floor(now / REQUEST_INTERVAL);
  if (comms.cycle === cycle) return;
  comms.cycle = cycle;
  const inhabited = !!civilizationOf(planet);
  const kinds: RequestKind[] = inhabited
    ? ["supplies", "communications", "energy", "freight"]
    : ["freight"];
  const kind = kinds[cycle % kinds.length]!;
  const cost: Inventory =
    kind === "freight" ? { iron: 18, wood: 12 } : { ...civicAid[kind].cost };
  const value = inventoryEntries(cost).reduce(
    (sum, [id, n]) =>
      sum +
      n *
        (marketItems.includes(id as MarketItem)
          ? marketPrice(id as MarketItem, "buy")
          : 60),
    0,
  );
  const request: BaseRequest = {
    id: `${planet.id}:request:${cycle}`,
    kind,
    title:
      kind === "freight"
        ? "Pedido comercial · suprimentos para cargueiros"
        : `Pedido de ajuda · ${civicAid[kind].title}`,
    cost,
    reward: Math.ceil(value * 1.35),
    influence: kind === "freight" ? 0 : 5,
    expires: now + REQUEST_LIFETIME,
    status: "available",
  };
  comms.requests = comms.requests
    .filter((r) => r.status !== "completed" && r.expires > now)
    .slice(-5);
  if (
    !(data.fulfilledRequests ?? []).includes(request.id) &&
    !comms.requests.some((r) => r.id === request.id)
  )
    comms.requests.push(request);
  comms.messages = [
    inhabited
      ? `${civilizationOf(planet)!.name}: canal do conselho conectado. Entregue suprimentos no posto para ganhar confiança.`
      : "Nenhum conselho habitado detectado. Canal comercial disponível.",
    "Aviso comercial: cargueiros compram apenas recursos autorizados depositados no entreposto. Orçamento de 6.000 CR e até 80 unidades por visita.",
    `Nova transmissão recebida · ciclo ${cycle + 1}. Pedidos duram 15 minutos de jogo ativo.`,
  ];
}
export function respondRequest(
  state: Save,
  planet: Planet,
  key: string,
  id: string,
  deliver: boolean,
) {
  const [x = 0, y = 0, z = 0] = key.split(",").map(Number);
  if (
    !onPlanet(state, planet.id) ||
    Math.hypot(
      (x + 1) * 16 - state.player.x,
      y * 16 + 8 - state.player.y,
      z * 16 - (state.player.surfaceZ ?? 0),
    ) > 76
  )
    return "Aproxime-se do posto de comunicações.";
  const data = state.settlements[planet.id];
  if (!data?.pieces[key]?.powered) return "Posto de comunicações sem energia.";
  const comms = data && communicationsState(data, key);
  const request = comms?.requests.find((r) => r.id === id);
  const now = state.activePlayTime ?? 0;
  if (
    !data ||
    !request ||
    request.expires <= now ||
    request.status === "completed" ||
    (data.fulfilledRequests ?? []).includes(id)
  )
    return "Pedido encerrado ou já entregue.";
  if (!deliver) {
    request.status = "accepted";
    return;
  }
  if (request.status !== "accepted")
    return "Aceite o pedido antes de entregar.";
  if (request.influence && !civilizationOf(planet))
    return "Conselho local indisponível.";
  const cargo = { ...state.backpack },
    balance = state.credits + request.reward;
  if (!Number.isSafeInteger(balance) || balance < 0)
    return "Limite de créditos atingido.";
  if (!consume(cargo, request.cost))
    return "Materiais insuficientes na mochila.";
  state.backpack = cargo;
  state.credits = balance;
  request.status = "completed";
  (data.fulfilledRequests ??= []).push(id);
  // Bound replay protection by monotonically increasing cycles, not a growing save log.
  data.fulfilledRequests = data.fulfilledRequests.slice(-64);
  if (request.influence) {
    const government = ((state.governments ??= {})[planet.id] ??= {
      aid: [],
      governed: false,
      projects: [],
    });
    if (request.kind !== "freight" && !government.aid.includes(request.kind))
      government.aid.push(request.kind);
    else
      government.goodwill = Math.min(
        20,
        (government.goodwill ?? 0) + request.influence,
      );
  }
}
