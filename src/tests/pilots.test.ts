import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { marketStock } from "../economy/market";
import {
  activateShip,
  buyShip,
  sellShip,
  transferShipCargo,
} from "../fleet/hangar";
import {
  advancePilotTrips,
  dismissPilot,
  hirePilot,
  startPilotRoute,
  stopPilotRepeat,
} from "../fleet/pilots";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";

const order = {
  destination: { x: 1, y: 0 },
  item: "iron",
  quantity: 20,
  repeat: false,
} as const;

function fleet() {
  setActivePinia(createPinia());
  const g = useGame();
  const state = g.state;
  state.mode = "docked";
  state.credits = 2000;
  expect(buyShip(state, "atlas")).toBeUndefined();
  const ship = state.parkedShips[0]!;
  return {
    state,
    ship,
    origin: g.system.station!.id,
    destination: systemAt(state.seed, 1, 0).station!.id,
  };
}

describe("pilotos comerciais", () => {
  it("cobra contratação e frete, transporta o lote e credita uma única vez", () => {
    const { state, ship, origin, destination } = fleet();
    ship.inventory.iron = 5;
    expect(hirePilot(state, ship.id)).toBeUndefined();
    expect(hirePilot(state, ship.id)).toBeTruthy();
    expect(state.credits).toBe(800);
    expect(startPilotRoute(state, ship.id, order)).toBeUndefined();
    expect(state.credits).toBe(518);
    expect(state.activeShip.model).toBe("sparrow");
    expect(marketStock(state, origin, "iron")).toBe(100);
    expect(ship.inventory.iron).toBe(25);
    expect(activateShip(state, ship.id)).toBeTruthy();
    expect(sellShip(state, ship.id)).toBeTruthy();
    expect(dismissPilot(state, ship.id)).toBeTruthy();
    expect(
      transferShipCargo(state, ship.id, state.activeShip.id, "iron", 1),
    ).toBeTruthy();
    expect(advancePilotTrips(state)).toBe(false);
    state.time = ship.pilot!.trip!.returnsAt;
    expect(advancePilotTrips(state)).toBe(true);
    expect(advancePilotTrips(state)).toBe(false);
    expect(state.credits).toBe(858);
    expect(ship.inventory.iron).toBe(5);
    expect(marketStock(state, destination, "iron")).toBe(140);
    expect(dismissPilot(state, ship.id)).toBeUndefined();
    expect(activateShip(state, ship.id)).toBeUndefined();
  });

  it("valida estoque, fundos e destino antes de alterar a carga", () => {
    const { state, ship, origin } = fleet();
    hirePilot(state, ship.id);
    state.marketStocks[origin] = { iron: 19 };
    const before = JSON.stringify(state);
    expect(startPilotRoute(state, ship.id, order)).toBeTruthy();
    expect(
      startPilotRoute(state, ship.id, {
        ...order,
        destination: { x: 9, y: 0 },
      }),
    ).toBeTruthy();
    expect(JSON.stringify(state)).toBe(before);
    state.credits = 100;
    expect(startPilotRoute(state, ship.id, order)).toBeTruthy();
    expect(state.credits).toBe(100);
    expect(ship.inventory).toEqual({});
  });

  it("repete a entrega e permite parar sem perder o lote que já saiu", () => {
    const { state, ship, destination } = fleet();
    hirePilot(state, ship.id);
    startPilotRoute(state, ship.id, { ...order, repeat: true });
    state.time = 60;
    expect(advancePilotTrips(state)).toBe(true);
    expect(ship.pilot?.trip?.returnsAt).toBe(120);
    expect(stopPilotRepeat(state, ship.id)).toBeUndefined();
    state.time = 120;
    expect(advancePilotTrips(state)).toBe(true);
    expect(ship.pilot?.trip).toBeUndefined();
    expect(state.credits).toBe(916);
    expect(marketStock(state, destination, "iron")).toBe(160);
  });

  it("salva uma viagem em curso e interrompe repetições sem estoque ao voltar", async () => {
    const { state, ship, origin } = fleet();
    state.marketStocks[origin] = { iron: 20 };
    hirePilot(state, ship.id);
    startPilotRoute(state, ship.id, { ...order, repeat: true });
    const db = new SaveDatabase(`pilot-${crypto.randomUUID()}`);
    try {
      await db.write(state);
      const restored = (await db.read())!;
      expect(restored).toEqual(JSON.parse(JSON.stringify(state)));
      restored.time = 60;
      expect(advancePilotTrips(restored)).toBe(true);
      expect(restored.credits).toBe(858);
      expect(restored.parkedShips[0]!.pilot?.trip).toBeUndefined();
      expect(restored.parkedShips[0]!.pilot?.message).toContain(
        "Estoque insuficiente",
      );
    } finally {
      await db.delete();
    }
  });
});
