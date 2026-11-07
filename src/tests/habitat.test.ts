import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { Terrain } from "../game/procedural/terrain";
import {
  emptySettlement,
  placePiece,
  removePiece,
  settlementFor,
} from "../construction/building";
import { pieceAt } from "../construction/pieces";
import {
  analyzeRoom,
  daylight,
  sunlightBetween,
  powerNetwork,
  advanceGenerator,
} from "../construction/habitat";
import { solidCell, stepSurface, type Actor } from "../game/physics/surface";
import { SaveDatabase } from "../persistence/database";
import type { SaveV2 } from "../persistence/migrations";
import { audio } from "../game/systems/audio";
audio.enabled = false;
beforeEach(() => setActivePinia(createPinia()));
function fixture() {
  const g = useGame();
  g.newGame("habitat");
  g.orbit(0);
  g.land(0);
  g.exit();
  g.state.player.x = 88;
  g.state.player.y = 452;
  g.state.player.oxygen = 30;
  g.state.time = 0;
  const terrain = new Terrain(g.planet, (g.state.changes[g.planet.id] ??= {})),
    data = settlementFor(g.state, g.planet.id);
  for (let x = 3; x <= 8; x++)
    data.pieces[`${x},25`] = { kind: "woodBlock", facing: 1 };
  data.pieces["3,26"] = { kind: "woodBlock", facing: 1 };
  data.pieces["3,28"] = { kind: "woodDoor", facing: 1, open: false };
  for (let y = 26; y <= 28; y++)
    data.pieces[`8,${y}`] = { kind: "woodBlock", facing: 1 };
  for (let x = 4; x <= 7; x++)
    for (let y = 26; y <= 28; y++) data.walls[`${x},${y}`] = true;
  data.pieces["6,28"] = {
    kind: "oxygenGenerator",
    facing: 1,
    energy: 0,
    oxygen: 0,
  };
  data.pieces["6,24"] = { kind: "solarPanel", facing: 1 };
  data.utilityTime = 0;
  data.cutTrees = ["tree:0"];
  return { g, data, terrain };
}
describe("Portas funcionais", () => {
  it("ocupa dois blocos, tem colisão fechada e permite passar aberta", () => {
    const { data, terrain } = fixture();
    expect(pieceAt(data, 3, 27)?.key).toBe("3,28");
    expect(solidCell(terrain, data, 3, 27)).toBe(true);
    expect(solidCell(terrain, data, 3, 28)).toBe(true);
    let actor: Actor = { x: 40, y: 452, vy: 0, grounded: true };
    for (let i = 0; i < 20; i++)
      actor = stepSurface(actor, 1, false, 1, 0.016, terrain, data);
    expect(actor.x).toBeLessThan(48);
    data.pieces["3,28"]!.open = true;
    for (let i = 0; i < 30; i++)
      actor = stepSurface(actor, 1, false, 1, 0.016, terrain, data);
    expect(actor.x).toBeGreaterThan(70);
  });
  it("impede fechar sobre o astronauta e permite interagir pela parte superior", () => {
    const { g, data } = fixture(),
      b = useConstruction();
    expect(b.interactAt(3, 27)).toBe(true);
    expect(data.pieces["3,28"]!.open).toBe(true);
    g.state.player.x = 56;
    expect(b.toggleDoor("3,28")).toBe(false);
    expect(data.pieces["3,28"]!.open).toBe(true);
    g.state.player.x = 88;
    expect(b.toggleDoor("3,28")).toBe(true);
    expect(data.pieces["3,28"]!.open).toBe(false);
  });
  it("valida as duas células antes de consumir e desmonta a porta uma única vez", () => {
    const { g, terrain } = fixture(),
      data = emptySettlement();
    g.state.player.x = 40;
    g.state.inventory = { woodDoor: 1 };
    const ctx = {
      terrain,
      settlement: data,
      player: g.state.player,
      inventory: g.state.inventory,
      capacity: 24,
      landingX: 0,
    };
    data.pieces["3,27"] = { kind: "woodBlock", facing: 1 };
    expect(placePiece(ctx, "woodDoor", 3, 28)).toBeTruthy();
    expect(g.state.inventory.woodDoor).toBe(1);
    delete data.pieces["3,27"];
    expect(placePiece(ctx, "woodDoor", 3, 28)).toBeUndefined();
    expect(g.state.inventory.woodDoor).toBeUndefined();
    expect(removePiece(ctx, 3, 27)).toBeUndefined();
    expect(g.state.inventory.woodDoor).toBe(1);
    expect(removePiece(ctx, 3, 28)).toBeTruthy();
    expect(g.state.inventory.woodDoor).toBe(1);
  });
});
describe("Vedação de casas", () => {
  it("identifica um cômodo fechado com piso, teto, fundo e porta", () => {
    const { terrain, data } = fixture(),
      room = analyzeRoom(terrain, data, 6, 28);
    expect(room.sealed).toBe(true);
    expect(room.cells.size).toBe(12);
    expect(room.cells.has("5,28")).toBe(true);
  });
  it("não considera portas abertas, buracos no teto ou fundo incompleto como abrigo", () => {
    const { terrain, data } = fixture();
    data.pieces["3,28"]!.open = true;
    expect(analyzeRoom(terrain, data, 6, 28).sealed).toBe(false);
    data.pieces["3,28"]!.open = false;
    delete data.pieces["6,25"];
    expect(analyzeRoom(terrain, data, 6, 28).sealed).toBe(false);
    data.pieces["6,25"] = { kind: "woodBlock", facing: 1 };
    delete data.walls["5,27"];
    expect(analyzeRoom(terrain, data, 6, 28).reason).toBe("walls");
  });
  it("limita o trabalho de busca em cômodos excessivamente grandes", () => {
    const { terrain, data } = fixture();
    expect(analyzeRoom(terrain, data, 6, 28, 2).reason).toBe("large");
  });
});
describe("Energia solar e reservas", () => {
  it("respeita noite sem sol e integra períodos longos sem simular cada segundo", () => {
    expect(daylight(0)).toBe(1);
    expect(daylight(Math.PI * 150)).toBe(0);
    expect(sunlightBetween(0, Math.PI * 300)).toBeCloseTo(300, 7);
    expect(sunlightBetween(400, 500)).toBe(0);
    const piece = { energy: 0, oxygen: 0 };
    advanceGenerator(piece, 1, 0, 1e8);
    expect(piece.energy).toBe(100);
    expect(piece.oxygen).toBe(100);
  });
  it("liga uma placa só ao gerador mais próximo, sem duplicar a energia", () => {
    const { terrain, data } = fixture();
    data.pieces["7,28"] = { kind: "oxygenGenerator", facing: 1 };
    let network = powerNetwork(terrain, data);
    expect(network.generators.reduce((n, g) => n + g.panels, 0)).toBe(1);
    expect(network.generators.find((g) => g.key === "6,28")!.panels).toBe(1);
    data.pieces["6,23"] = { kind: "woodBlock", facing: 1 };
    network = powerNetwork(terrain, data);
    expect(network.exposedPanels).toBe(0);
    expect(network.generators.reduce((n, g) => n + g.panels, 0)).toBe(0);
  });
  it("não liga uma placa distante nem permite painel sombreado por outro painel", () => {
    const { terrain, data } = fixture();
    delete data.pieces["6,24"];
    data.pieces["30,15"] = { kind: "solarPanel", facing: 1 };
    expect(powerNetwork(terrain, data).generators[0]!.panels).toBe(0);
    delete data.pieces["30,15"];
    data.pieces["6,24"] = { kind: "solarPanel", facing: 1 };
    data.pieces["6,23"] = { kind: "solarPanel", facing: 1 };
    expect(powerNetwork(terrain, data).exposedPanels).toBe(1);
  });
  it("consome energia real para produzir oxigênio e mantém reservas limitadas", () => {
    const piece = { energy: 10, oxygen: 0 };
    advanceGenerator(piece, 0, 0, 100);
    expect(piece.energy).toBe(0);
    expect(piece.oxygen).toBe(30);
    advanceGenerator(piece, 0, 100, 200);
    expect(piece.oxygen).toBe(30);
    const empty = { energy: 0, oxygen: 0 };
    advanceGenerator(empty, 1, 400, 500);
    expect(empty).toEqual({ energy: 0, oxygen: 0 });
  });
});
describe("Recarga do traje dentro da casa", () => {
  it("recarrega automaticamente e interrompe ao abrir a porta", () => {
    const { g, data } = fixture(),
      b = useConstruction();
    g.tick(1);
    expect(g.habitat.supplied).toBe(true);
    expect(g.state.player.oxygen).toBeGreaterThan(30);
    expect(data.pieces["6,28"]!.energy).toBeGreaterThan(0);
    b.toggleDoor("3,28");
    const before = g.state.player.oxygen;
    g.tick(1);
    expect(g.habitat.supplied).toBe(false);
    expect(g.state.player.oxygen).toBeLessThan(before);
    b.toggleDoor("3,28");
    g.tick(1);
    expect(g.habitat.supplied).toBe(true);
    expect(g.state.player.oxygen).toBeGreaterThan(before);
  });
  it("não recarrega sem energia, sem gerador ou usando o gerador de outro cômodo", () => {
    const { g, data } = fixture();
    g.state.time = 450;
    data.utilityTime = 450;
    g.tick(1);
    expect(g.habitat.supplied).toBe(false);
    expect(g.state.player.oxygen).toBeLessThan(30);
    delete data.pieces["6,28"];
    g.worldChanged();
    g.tick(1);
    expect(g.habitat.reason).toBe("no-generator");
    data.pieces["7,28"] = {
      kind: "oxygenGenerator",
      facing: 1,
      energy: 50,
      oxygen: 50,
    };
    for (let y = 26; y <= 28; y++)
      data.pieces[`6,${y}`] = { kind: "woodBlock", facing: 1 };
    g.worldChanged();
    g.tick(1);
    expect(g.habitat.supplied).toBe(false);
  });
  it("usa as reservas à noite, não ultrapassa 100% e interrompe após perder a parede", () => {
    const { g, data } = fixture();
    g.state.time = 450;
    data.utilityTime = 450;
    data.pieces["6,28"]!.energy = 20;
    g.state.player.oxygen = 99;
    g.tick(1);
    expect(g.state.player.oxygen).toBe(100);
    expect(g.habitat.supplied).toBe(true);
    delete data.walls["5,27"];
    g.worldChanged();
    g.tick(1);
    expect(g.habitat.supplied).toBe(false);
    expect(g.state.player.oxygen).toBeLessThan(100);
  });
  it("atualiza as reservas ao retornar a um planeta sem misturar sistemas", () => {
    const { g, data } = fixture();
    g.enter();
    g.tick(10);
    const energy = data.pieces["6,28"]!.energy!;
    g.state.systemX = 10;
    g.tick(50);
    expect(data.pieces["6,28"]!.energy).toBe(energy);
    g.state.systemX = 0;
    g.tick(0.04);
    expect(data.pieces["6,28"]!.energy).toBeGreaterThan(energy);
    expect(data.pieces["6,28"]!.oxygen).toBe(100);
  });
});
describe("Persistência das casas pressurizadas", () => {
  it("migra um banco v2 preservando casas, árvores e armários", async () => {
    const { g, data } = fixture(),
      name = `habitat-v2-${crypto.randomUUID()}`;
    data.cabinets["4,28"] = { wood: 17 };
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    const old = {
        ...JSON.parse(JSON.stringify(g.state)),
        version: 2,
      } as SaveV2,
      legacy = new Dexie(name);
    legacy.version(2).stores({ saves: "id,updated" });
    await legacy
      .table("saves")
      .put({ id: "commander", data: old, updated: 123 });
    legacy.close();
    const db = new SaveDatabase(name),
      saved = await db.read();
    expect(saved).toEqual({ ...old, version: 3 });
    expect(db.verno).toBe(3);
    await db.delete();
  });
  it("salva porta aberta e reservas exatas e continua a simulação ao carregar", async () => {
    const { g, data } = fixture(),
      name = `habitat-save-${crypto.randomUUID()}`;
    g.tick(3);
    data.pieces["3,28"]!.open = true;
    g.worldChanged();
    const before = JSON.parse(JSON.stringify(g.state)),
      db = new SaveDatabase(name);
    await db.write(g.state);
    db.close();
    const next = new SaveDatabase(name),
      saved = await next.read();
    expect(saved).toEqual(before);
    expect(saved!.settlements[g.planet.id]!.pieces["3,28"]!.open).toBe(true);
    expect(saved!.settlements[g.planet.id]!.pieces["6,28"]!.energy).toBe(
      data.pieces["6,28"]!.energy,
    );
    await next.delete();
  });
  it("as novas receitas consomem os materiais na oficina de campo", () => {
    const { g } = fixture();
    g.state.inventory = {
      wood: 4,
      iron: 1,
      plate: 4,
      copper: 2,
      silicon: 3,
      circuit: 2,
      cell: 1,
    };
    g.make("woodDoor");
    g.make("solarPanel");
    g.make("oxygenGenerator");
    expect(g.state.inventory).toEqual({
      woodDoor: 1,
      solarPanel: 1,
      oxygenGenerator: 1,
    });
  });
});

describe("Conservação e alcance do suporte de vida", () => {
  it("estar próximo, mas fora da casa, não recarrega o traje", () => {
    const { g } = fixture();
    g.state.player.x = 40;
    g.tick(1);
    expect(g.habitat.supplied).toBe(false);
    expect(g.habitat.reason).toBe("outside");
    expect(g.state.player.oxygen).toBeLessThan(30);
  });
  it("não produz nem transfere oxigênio quando nenhum tempo passou", () => {
    const { g, data } = fixture();
    g.tick(2);
    const before = JSON.stringify(g.state);
    g.refreshHabitat();
    expect(JSON.stringify(g.state)).toBe(before);
    expect(data.utilityTime).toBe(g.state.time);
  });
  it("não concede geração retroativa ao instalar um novo equipamento", () => {
    const { g, data } = fixture(),
      b = useConstruction();
    delete data.pieces["6,28"];
    g.state.time = 100;
    data.utilityTime = 0;
    g.state.player.x = 40;
    g.state.inventory = { oxygenGenerator: 1 };
    b.equip("oxygenGenerator");
    expect(b.apply(6, 28)).toBe(true);
    expect(data.pieces["6,28"]!.energy).toBe(0);
    expect(data.utilityTime).toBe(100);
    g.tick(1);
    expect(data.pieces["6,28"]!.energy).toBeLessThan(8);
    expect(data.pieces["6,28"]!.oxygen).toBe(6);
  });
});
