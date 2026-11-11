import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { marketStock, trade } from "../economy/market";
import type { SaveV3 } from "../persistence/migrations";
import { systemAt } from "../universe/generator";
import Dexie from "dexie";
import {
  activateShip,
  buyShip,
  sellShip,
  transferShipCargo,
} from "../fleet/hangar";
import { database, SaveDatabase } from "../persistence/database";
import { shipBlueprints } from "../fleet/shipBlueprints";
import { shipModels } from "../fleet/models";

describe("mercado galáctico", () => {
  it("compra e vende usando o saldo e o estoque da estação", () => {
    setActivePinia(createPinia());
    const { state } = useGame();
    expect(state.credits).toBe(500);
    expect(trade(state, "alpha", "iron", "buy", 10, 24)).toBeUndefined();
    expect(state.credits).toBe(380);
    expect(state.inventory.iron).toBe(10);
    expect(marketStock(state, "alpha", "iron")).toBe(110);
    expect(trade(state, "alpha", "iron", "sell", 4, 24)).toBeUndefined();
    expect(state.credits).toBe(416);
    expect(state.inventory.iron).toBe(6);
    expect(marketStock(state, "alpha", "iron")).toBe(114);
    expect(marketStock(state, "beta", "iron")).toBe(120);
  });

  it("não altera nada por falta de crédito, estoque, carga ou quantidade inválida", () => {
    setActivePinia(createPinia());
    const { state } = useGame();
    state.marketStocks.alpha = { iron: 3 };
    const before = JSON.stringify(state);
    expect(trade(state, "alpha", "iron", "buy", 1, 0)).toBeTruthy();
    expect(trade(state, "alpha", "iron", "buy", 4, 24)).toBeTruthy();
    expect(trade(state, "alpha", "iron", "buy", 60, 24)).toBeTruthy();
    expect(trade(state, "alpha", "iron", "sell", 1, 24)).toBeTruthy();
    expect(trade(state, "alpha", "iron", "buy", -1, 24)).toBeTruthy();
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("estações procedurais", () => {
  it("oferece estação inicial e distribuição determinística em outros sistemas", () => {
    expect(systemAt("expedição", 0, 0).station).toBeDefined();
    const positions = Array.from(
      { length: 30 },
      (_, i) => systemAt("expedição", i + 1, -1).station,
    );
    expect(positions.some(Boolean)).toBe(true);
    expect(positions.some((station) => !station)).toBe(true);
    expect(systemAt("expedição", 1, -1).station).toEqual(positions[0]);
  });

  it("exige aproximação e velocidade segura para acoplar e permite partir", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    const write = vi.spyOn(database, "write").mockResolvedValue(undefined);
    try {
      g.started = true;
      expect(g.dock()).toBe(false);
      const station = g.system.station!;
      Object.assign(g.state.ship, { x: station.x, y: station.y + 90, vx: 60 });
      expect(g.dock()).toBe(true);
      expect(g.state.mode).toBe("space");
      g.state.ship.vx = 0;
      expect(g.dock()).toBe(true);
      expect(g.state.mode).toBe("space");
      g.advanceDocking(1);
      expect(g.state.mode).toBe("space");
      g.advanceDocking(0.8);
      expect(g.state.mode).toBe("docked");
      expect(
        await g.stationTransaction((draft, id) =>
          trade(draft, id, "iron", "buy", 1, 24),
        ),
      ).toBe(true);
      expect(g.state.credits).toBe(488);
      g.undock();
      expect(g.state.mode).toBe("space");
      expect(g.state.ship.x).toBeGreaterThan(station.x);
      expect(await g.stationTransaction(() => undefined)).toBe(false);
    } finally {
      write.mockRestore();
    }
  });

  it("preserva saldo, carga e estoque se a gravação da transação falhar", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    g.started = true;
    g.state.mode = "docked";
    const write = vi
      .spyOn(database, "write")
      .mockRejectedValue(new Error("quota"));
    try {
      const before = JSON.stringify(g.state);
      expect(
        await g.stationTransaction((draft, id) =>
          trade(draft, id, "iron", "buy", 1, 24),
        ),
      ).toBe(false);
      expect(JSON.stringify(g.state)).toBe(before);
      expect(g.trading).toBe(false);
    } finally {
      write.mockRestore();
    }
  });
});

describe("frota e hangar", () => {
  function docked() {
    setActivePinia(createPinia());
    const g = useGame();
    g.started = true;
    g.state.mode = "docked";
    g.state.credits = 2500;
    return g;
  }

  it("compra instâncias distintas, respeita o saldo e não vende a nave ativa", () => {
    const { state } = docked();
    expect(sellShip(state, state.activeShip.id)).toBeTruthy();
    expect(buyShip(state, "atlas")).toBeUndefined();
    expect(buyShip(state, "atlas")).toBeUndefined();
    const ids = [
      state.activeShip.id,
      ...state.parkedShips.map((ship) => ship.id),
    ];
    expect(new Set(ids).size).toBe(3);
    expect(state.credits).toBe(300);
    expect(buyShip(state, "viper")).toBeTruthy();
    expect(state.parkedShips).toHaveLength(2);
    expect(state.credits).toBe(300);
  });

  it("troca os atributos e devolve a nave original com seu estado intacto", () => {
    const g = docked(),
      state = g.state;
    state.inventory = { iron: 21 };
    state.upgrades = ["jump", "cargo", "tank"];
    state.ship.fuel = 37;
    state.ship.hull = 61;
    buyShip(state, "atlas");
    const atlas = state.parkedShips[0]!.id;
    expect(activateShip(state, atlas)).toBeUndefined();
    expect(g.model.name).toBe("Atlas C-2");
    expect(g.capacity).toBe(56);
    expect(g.maxFuel).toBe(150);
    expect(g.hullPercent).toBe(100);
    expect(state.inventory).toEqual({});
    expect(state.upgrades).toEqual([]);
    expect(activateShip(state, "ship-1")).toBeUndefined();
    expect(g.capacity).toBe(40);
    expect(g.maxFuel).toBe(160);
    expect(state.inventory).toEqual({ iron: 21 });
    expect(state.upgrades).toEqual(["jump", "cargo", "tank"]);
    expect(state.ship.fuel).toBe(37);
    expect(state.ship.hull).toBe(61);
    expect(state.parkedShips.map((ship) => ship.id)).toEqual([atlas]);
  });

  it("vende 20 modelos premium na concessionária e permite assumir a nave de 2 milhões", () => {
    const g = docked();
    expect(
      Object.entries(shipModels).filter(
        ([id, { price }]) => price > 2950 && !Object.hasOwn(shipBlueprints, id),
      ),
    ).toHaveLength(20);
    expect(
      Math.max(...Object.values(shipModels).map(({ price }) => price)),
    ).toBe(2_000_000);
    g.state.credits = 1_999_999;
    expect(buyShip(g.state, "colossus")).toBeTruthy();
    expect(g.state.parkedShips).toHaveLength(0);
    expect(g.state.credits).toBe(1_999_999);
    g.state.credits = 2_000_000;
    expect(buyShip(g.state, "colossus")).toBeUndefined();
    expect(g.state.credits).toBe(0);
    expect(activateShip(g.state, g.state.parkedShips[0]!.id)).toBeUndefined();
    expect(g.model.name).toBe("Colossus C-99");
    expect(g.capacity).toBe(376);
  });

  it("exige o mesmo hangar, preserva carga se cheia e permite vender a nave vazia", () => {
    const { state } = docked();
    buyShip(state, "atlas");
    const atlas = state.parkedShips[0]!;
    atlas.inventory = { iron: 12 };
    state.systemX = 1;
    expect(activateShip(state, atlas.id)).toBeTruthy();
    expect(
      transferShipCargo(state, atlas.id, "ship-1", "iron", 12),
    ).toBeTruthy();
    expect(sellShip(state, atlas.id)).toBeTruthy();
    state.systemX = 0;
    expect(sellShip(state, atlas.id)).toBeTruthy();
    state.inventory = { copper: 24 * 99 };
    expect(
      transferShipCargo(state, atlas.id, "ship-1", "iron", 12),
    ).toBeTruthy();
    expect(atlas.inventory.iron).toBe(12);
    state.inventory = {};
    expect(
      transferShipCargo(state, atlas.id, "ship-1", "iron", 12),
    ).toBeUndefined();
    expect(state.inventory.iron).toBe(12);
    expect(sellShip(state, atlas.id)).toBeUndefined();
    expect(state.credits).toBe(2060);
    expect(sellShip(state, atlas.id)).toBeTruthy();
    expect(state.credits).toBe(2060);
  });

  it("bloqueia outra compra e a partida enquanto a gravação está pendente", async () => {
    const g = docked();
    let finish!: () => void;
    const write = vi.spyOn(database, "write").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    try {
      const pending = g.stationTransaction((draft) => buyShip(draft, "atlas"));
      expect(
        await g.stationTransaction((draft) => buyShip(draft, "atlas")),
      ).toBe(false);
      g.undock();
      expect(g.state.mode).toBe("docked");
      expect(g.state.parkedShips).toHaveLength(0);
      finish();
      expect(await pending).toBe(true);
      expect(g.state.parkedShips).toHaveLength(1);
      expect(g.state.credits).toBe(1400);
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      write.mockRestore();
    }
  });

  it("migra um save v3 real e reabre créditos, estoques e frota após troca", async () => {
    const g = docked();
    const name = `fleet-${crypto.randomUUID()}`;
    const {
      activeShip,
      parkedShips,
      nextShipId,
      credits,
      marketStocks,
      ...old
    } = JSON.parse(JSON.stringify(g.state)) as typeof g.state;
    void [activeShip, parkedShips, nextShipId, credits, marketStocks];
    const legacy: SaveV3 = {
      ...old,
      version: 3,
      mode: "surface",
      inventory: { iron: 50, copper: 30 },
      upgrades: ["tank"],
    };
    legacy.ship.hull = 47;
    legacy.ship.fuel = 53;
    legacy.changes[g.planet.id] = { "2,10": 0 };
    const db3 = new Dexie(name);
    db3.version(3).stores({ saves: "id,updated" });
    await db3.table("saves").put({ id: "commander", data: legacy, updated: 1 });
    db3.close();
    const db = new SaveDatabase(name);
    const state = (await db.read())!;
    expect(state).toEqual({
      ...legacy,
      version: 4,
      credits: 500,
      marketStocks: {},
      parkedShips: [],
      activeShip: { id: "ship-1", model: "sparrow" },
      nextShipId: 2,
    });
    state.mode = "docked";
    const station = g.system.station!.id;
    expect(trade(state, station, "iron", "sell", 50, 40)).toBeUndefined();
    expect(trade(state, station, "copper", "sell", 30, 40)).toBeUndefined();
    expect(buyShip(state, "atlas")).toBeUndefined();
    expect(activateShip(state, "ship-2")).toBeUndefined();
    await db.write(state);
    db.close();
    const reopened = new SaveDatabase(name);
    try {
      expect(await reopened.read()).toEqual(state);
      expect(state.credits).toBe(210);
      expect(state.parkedShips[0]!.ship.hull).toBe(47);
      expect(state.parkedShips[0]!.upgrades).toEqual(["tank"]);
    } finally {
      await reopened.delete();
    }
  });
});

it("retoma um save v4 da economia anterior à frota sem perder o estado da superfície", async () => {
  setActivePinia(createPinia());
  const g = useGame();
  const { activeShip, parkedShips, nextShipId, ...earlySave } = JSON.parse(
    JSON.stringify(g.state),
  ) as typeof g.state;
  void [activeShip, parkedShips, nextShipId];
  earlySave.mode = "surface";
  earlySave.player = {
    x: 88,
    y: 452,
    health: 100,
    oxygen: 60,
    energy: 100,
    hunger: 100,
  };
  earlySave.credits = 0;
  earlySave.inventory = { copper: 8 };
  earlySave.marketStocks[g.system.station!.id] = { copper: 112 };

  const db = new SaveDatabase(`early-economy-${crypto.randomUUID()}`);
  try {
    await db.saves.put({ id: "commander", data: earlySave, updated: 1 });
    expect(await db.read()).toEqual({
      ...earlySave,
      activeShip: { id: "ship-1", model: "sparrow" },
      parkedShips: [],
      nextShipId: 2,
    });
  } finally {
    await db.delete();
  }
});
