import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { emptySettlement } from "../construction/building";
import { machineAt } from "../construction/facilities";
import {
  advanceTrading,
  advanceCommunications,
  tradingState,
  communicationsState,
  sellToVisitor,
  setSaleItem,
  purchaseVisitor,
  respondRequest,
  cargoLandingSite,
  TRADE_INTERVAL,
} from "../construction/planetCommerce";
import { Terrain } from "../game/procedural/terrain";
import { shipModels } from "../fleet/models";
import { planetaryInfluence } from "../diplomacy/governance";
import { migrateSave } from "../persistence/migrations";
import { SaveDatabase } from "../persistence/database";
import type { CargoVisit } from "../construction/planetCommerce";
beforeEach(() => setActivePinia(createPinia()));
function setup(inhabited = false) {
  const g = useGame();
  g.newGame("VOIDBOUND");
  g.state.mode = "surface";
  g.state.planetIndex = inhabited ? 1 : 0;
  g.state.player.x = 16;
  g.state.player.y = 440;
  g.state.player.surfaceZ = 0;
  const data = (g.state.settlements[g.planet.id] = emptySettlement());
  data.pieces["0,28"] = { kind: "tradingPost", facing: 1, powered: true };
  data.pieces["3,28"] = {
    kind: "communicationsPost",
    facing: 1,
    powered: true,
  };
  const machine = machineAt(data, "0,28")!;
  machineAt(data, "3,28");
  const trade = tradingState(data, "0,28")!;
  const terrain = new Terrain(g.planet, {});
  const visit: CargoVisit = {
    id: "visit-1",
    model: "atlas",
    phase: "landed",
    elapsed: 0,
    x: 16,
    y: 448,
    z: 0,
    traded: false,
  };
  return { g, data, machine, trade, terrain, visit };
}
describe("entreposto e comunicações", () => {
  it("vende somente estoque autorizado e paga uma única vez", () => {
    const { g, data, machine, trade, visit } = setup();
    g.state.backpack = { iron: 40 };
    g.state.inventory = { iron: 70 };
    data.cabinets["10,28"] = { iron: 99 };
    machine.input = { iron: 10, copper: 15 };
    trade.visitor = visit;
    expect(setSaleItem(data, "0,28", "iron", true)).toBeUndefined();
    sellToVisitor(g.state, g.planet.id, "0,28");
    expect(g.state.credits).toBe(590);
    expect(machine.input).toEqual({ copper: 15 });
    sellToVisitor(g.state, g.planet.id, "0,28");
    expect(g.state.credits).toBe(590);
    expect(g.state.backpack.iron).toBe(40);
    expect(g.state.inventory.iron).toBe(70);
    expect(data.cabinets["10,28"]!.iron).toBe(99);
    expect(trade.history).toHaveLength(1);
  });
  it("limita a compra por visita, preserva sobras e rejeita itens não negociáveis", () => {
    const { g, data, machine, trade, visit } = setup();
    machine.input = { iron: 100 };
    trade.enabled.iron = true;
    trade.visitor = visit;
    expect(setSaleItem(data, "0,28", "woodBlock", true)).toBeTruthy();
    sellToVisitor(g.state, g.planet.id, "0,28");
    expect(machine.input.iron).toBe(20);
    expect(g.state.credits).toBe(1220);
  });
  it("saldo inválido aborta a venda sem consumir ou marcar a visita", () => {
    const { g, machine, trade, visit } = setup();
    machine.input = { iron: 10 };
    trade.enabled.iron = true;
    trade.visitor = visit;
    g.state.credits = Number.MAX_SAFE_INTEGER;
    sellToVisitor(g.state, g.planet.id, "0,28");
    expect(machine.input.iron).toBe(10);
    expect(visit.traded).toBe(false);
  });
  it("compra cargueiro sem duplicação e preserva nave/carga atuais", () => {
    const { g, trade, visit } = setup();
    trade.visitor = visit;
    g.state.credits = 5000;
    const active = g.state.activeShip.id,
      cargo = JSON.stringify(g.state.inventory);
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeUndefined();
    expect(g.state.credits).toBe(5000 - shipModels.atlas.price);
    expect(g.state.parkedShips).toHaveLength(1);
    expect(g.state.parkedShips[0]!.location).toEqual({ x: 0, y: 0 });
    expect(g.state.activeShip.id).toBe(active);
    expect(JSON.stringify(g.state.inventory)).toBe(cargo);
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeTruthy();
    expect(g.state.parkedShips).toHaveLength(1);
  });
  it("rejeita compra distante, em trânsito, sem saldo e com serial inválido", () => {
    const { g, trade, visit } = setup();
    trade.visitor = visit;
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeTruthy();
    g.state.credits = 5000;
    visit.phase = "arriving";
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeTruthy();
    visit.phase = "landed";
    g.state.player.x = 1000;
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeTruthy();
    g.state.player.x = 16;
    g.state.nextShipId = 1;
    expect(purchaseVisitor(g.state, g.planet.id, "0,28")).toBeTruthy();
    expect(g.state.credits).toBe(5000);
  });
  it("aproxima, pousa, vende e decola com tempo ativo sem exigir energia após despacho", () => {
    const { g, machine, trade, terrain, visit } = setup();
    machine.input = { iron: 10 };
    trade.enabled.iron = true;
    trade.visitor = { ...visit, phase: "arriving" };
    advanceTrading(g.state, g.planet, terrain, "0,28", 12, 0);
    expect(trade.visitor?.phase).toBe("landed");
    expect(g.state.credits).toBe(590);
    advanceTrading(g.state, g.planet, terrain, "0,28", 60, 0);
    expect(trade.visitor?.phase).toBe("departing");
    advanceTrading(g.state, g.planet, terrain, "0,28", 12, 0);
    expect(trade.visitor).toBeUndefined();
    advanceTrading(g.state, g.planet, terrain, "0,28", 180, 0);
    expect(trade.wait).toBe(0);
  });
  it("não inicia visitas sem autorização, estoque ou energia", () => {
    const { g, machine, trade, terrain } = setup();
    machine.input = { iron: 10 };
    advanceTrading(g.state, g.planet, terrain, "0,28", 180, 180);
    expect(trade.visitor).toBeUndefined();
    trade.enabled.iron = true;
    advanceTrading(g.state, g.planet, terrain, "0,28", 180, 0);
    expect(trade.wait).toBe(0);
    advanceTrading(g.state, g.planet, terrain, "0,28", 1, 1);
    expect(trade.wait).toBe(1);
  });
  it("pouso procura terreno livre e bloqueia construção sobre o local", () => {
    const { g, data, terrain } = setup();
    for (let x = -14; x <= 14; x++)
      for (let z = -14; z <= 14; z++) data.cutTrees.push(`grove:${x}:${z}`);
    for (let x = -10; x <= 10; x++) data.cutTrees.push(`tree:${x}`);
    const site = cargoLandingSite(g.state, g.planet, terrain, "0,28");
    expect(site).toBeDefined();
    if (site) {
      const key = `${Math.floor(site.x / 16)},${Math.floor(site.y / 16) - 1}${site.z ? "," + site.z / 16 : ""}`;
      data.pieces[key] = { kind: "woodBlock", facing: 1 };
      expect(cargoLandingSite(g.state, g.planet, terrain, "0,28")).not.toEqual(
        site,
      );
    }
    vi.spyOn(terrain, "heightAt").mockReturnValue(0);
    expect(
      cargoLandingSite(g.state, g.planet, terrain, "0,28"),
    ).toBeUndefined();
    if (site)
      expect(Math.abs(site.x - g.state.landingX * 16)).toBeGreaterThan(180);
  });
  it("renova transmissões com energia, sem duplicar o ciclo e sem conselho em planeta desabitado", () => {
    const { g, data } = setup();
    advanceCommunications(g.state, g.planet, "3,28", 0);
    expect(communicationsState(data, "3,28")!.requests).toEqual([]);
    advanceCommunications(g.state, g.planet, "3,28", 1);
    const comms = communicationsState(data, "3,28")!;
    expect(comms.requests).toHaveLength(1);
    expect(comms.requests[0]!.influence).toBe(0);
    advanceCommunications(g.state, g.planet, "3,28", 1);
    expect(comms.requests).toHaveLength(1);
    g.state.activePlayTime = 300;
    advanceCommunications(g.state, g.planet, "3,28", 1);
    expect(comms.requests.some((r) => r.id.endsWith(":1"))).toBe(true);
    expect(comms.requests[0]!.id.endsWith(":0")).toBe(true);
  });
  it("entrega exige aceitar, materiais e alcance; recompensa e influência não repetem", () => {
    const { g, data } = setup(true);
    advanceCommunications(g.state, g.planet, "3,28", 1);
    const request = communicationsState(data, "3,28")!.requests[0]!;
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, true),
    ).toBeTruthy();
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, false),
    ).toBeUndefined();
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, true),
    ).toBeTruthy();
    g.state.backpack = { ...request.cost };
    const initial = g.state.credits;
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, true),
    ).toBeUndefined();
    expect(g.state.credits).toBe(initial + request.reward);
    expect(planetaryInfluence(g.state.governments?.[g.planet.id])).toBe(20);
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, true),
    ).toBeTruthy();
    expect(g.state.credits).toBe(initial + request.reward);
    data.pieces["3,28"]!.powered = false;
    expect(
      respondRequest(g.state, g.planet, "3,28", request.id, false),
    ).toBeTruthy();
  });
  it("expiração e entrega em outro planeta não consomem suprimentos", () => {
    const { g, data } = setup(true);
    advanceCommunications(g.state, g.planet, "3,28", 1);
    const r = communicationsState(data, "3,28")!.requests[0]!;
    g.state.backpack = { ...r.cost };
    respondRequest(g.state, g.planet, "3,28", r.id, false);
    g.state.activePlayTime = r.expires;
    expect(respondRequest(g.state, g.planet, "3,28", r.id, true)).toBeTruthy();
    expect(g.state.backpack).toEqual(r.cost);
    g.state.activePlayTime = 0;
    const planet = g.planet;
    g.state.planetIndex = 0;
    expect(respondRequest(g.state, planet, "3,28", r.id, true)).toBeTruthy();
    expect(g.state.backpack).toEqual(r.cost);
  });
  it("store revalida a distância para configuração, depósitos e compra", () => {
    const { g, trade, visit } = setup();
    trade.visitor = visit;
    const b = useConstruction();
    expect(b.interactAt(0, 28)).toBe(true);
    expect(b.configureSale("iron", true)).toBe(true);
    g.state.player.x = 2000;
    expect(b.configureSale("iron", false)).toBe(false);
    expect(b.buyCargoVisitor()).toBe(false);
    expect(b.moveFacility(true, true, "iron", 1)).toBe(false);
  });
  it("não paga o mesmo pedido em dois postos nem ultrapassa a influência máxima", () => {
    const { g, data } = setup(true);
    g.state.player.x = 64;
    data.pieces["6,28"] = {
      kind: "communicationsPost",
      facing: 1,
      powered: true,
    };
    machineAt(data, "6,28");
    advanceCommunications(g.state, g.planet, "3,28", 1);
    advanceCommunications(g.state, g.planet, "6,28", 1);
    const r = communicationsState(data, "3,28")!.requests[0]!;
    expect(communicationsState(data, "6,28")!.requests[0]!.id).toBe(r.id);
    g.state.backpack = { iron: 24, copper: 12 };
    respondRequest(g.state, g.planet, "3,28", r.id, false);
    expect(
      respondRequest(g.state, g.planet, "3,28", r.id, true),
    ).toBeUndefined();
    const balance = g.state.credits;
    expect(respondRequest(g.state, g.planet, "6,28", r.id, false)).toBeTruthy();
    expect(g.state.credits).toBe(balance);
    expect(g.state.backpack.iron).toBe(12);
    expect(
      planetaryInfluence({
        aid: ["supplies", "communications", "energy"],
        governed: true,
        projects: ["clinic", "logistics"],
        goodwill: 20,
      }),
    ).toBe(100);
  });
  it("desmontagem não apaga cargueiro em trânsito e filtros comerciais incluem os dois postos", async () => {
    const { g, data, terrain, trade, visit } = setup();
    trade.visitor = visit;
    const { removePiece } = await import("../construction/building");
    const error = removePiece(
      {
        terrain,
        landingX: g.state.landingX,
        settlement: data,
        player: g.state.player,
        inventory: g.state.backpack,
        capacity: 24,
      },
      0,
      28,
    );
    expect(error).toContain("cargueiro");
    expect(data.pieces["0,28"]).toBeDefined();
    const { filterBuildItems } = await import("../construction/menu");
    expect(
      filterBuildItems(
        {},
        {
          search: "",
          category: "commerce",
          owned: false,
          sort: "name",
        },
      ).sort(),
    ).toEqual(["communicationsPost", "tradingPost"]);
  });
  it("save/load preserva seleção, depósito, visita e pedidos; save antigo inicia sem comércio", async () => {
    const { g, data, machine, trade, visit } = setup(true);
    trade.visitor = visit;
    trade.wait = TRADE_INTERVAL;
    trade.enabled.iron = true;
    machine.input = { iron: 9 };
    advanceCommunications(g.state, g.planet, "3,28", 1);
    const db = new SaveDatabase("commerce-test");
    await db.write(g.state);
    const saved = await db.localSlot();
    const restored = migrateSave(saved!.data);
    expect(restored.settlements[g.planet.id]!.machines).toEqual(data.machines);
    delete restored.settlements[g.planet.id]!.machines;
    expect(
      migrateSave(restored).settlements[g.planet.id]!.machines,
    ).toBeUndefined();
    await db.delete();
  });
});
