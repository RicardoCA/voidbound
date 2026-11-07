import type { Inventory, Item, Save } from "../game/types";
import { add, consume } from "../inventory/inventory";

export const INITIAL_CREDITS = 500;

const prices = {
  iron: 12,
  copper: 16,
  silicon: 14,
  carbon: 10,
  titanium: 38,
  crystal: 42,
  ice: 8,
  fiber: 9,
  wood: 8,
  rawFuel: 20,
} satisfies Partial<Record<Item, number>>;

export const marketItems = Object.keys(prices) as (keyof typeof prices)[];
export type MarketItem = (typeof marketItems)[number];
export type TradeSide = "buy" | "sell";

export function marketPrice(item: MarketItem, side: TradeSide) {
  return side === "buy" ? prices[item] : Math.floor(prices[item] * 0.75);
}

export function marketStock(state: Save, station: string, item: MarketItem) {
  return state.marketStocks[station]?.[item] ?? 120;
}

// Mutate only after validating the complete transaction.
export function trade(
  state: Save,
  station: string,
  item: MarketItem,
  side: TradeSide,
  quantity: number,
  capacity: number,
): string | undefined {
  if (
    !marketItems.includes(item) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  )
    return "Escolha um recurso e uma quantidade inteira positiva.";
  const total = quantity * marketPrice(item, side);
  const stock = marketStock(state, station, item);
  const buying = side === "buy";
  const balance = state.credits + (buying ? -total : total);
  const nextStock = stock + (buying ? -quantity : quantity);
  if (!Number.isSafeInteger(balance) || balance < 0)
    return "Saldo insuficiente.";
  if (!Number.isSafeInteger(nextStock) || nextStock < 0)
    return "Estoque insuficiente.";
  const cargo: Inventory = { ...state.inventory };
  if (
    buying
      ? !add(cargo, item, quantity, capacity)
      : !consume(cargo, { [item]: quantity })
  )
    return buying
      ? "Carga sem espaço para a compra."
      : "Quantidade indisponível na sua carga.";
  state.inventory = cargo;
  state.credits = balance;
  (state.marketStocks[station] ??= {})[item] = nextStock;
}
