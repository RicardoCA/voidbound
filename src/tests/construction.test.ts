import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { Terrain } from "../game/procedural/terrain";
import { treeAt, treesInRange } from "../game/procedural/trees";
import { systemAt } from "../universe/generator";
import {
  emptySettlement,
  placePiece,
  removePiece,
  settlementFor,
  transfer,
} from "../construction/building";
import { stepSurface, solidCell, type Actor } from "../game/physics/surface";
import { craft, recipes } from "../crafting/recipes";
import { SaveDatabase } from "../persistence/database";
import { migrateSave, type LegacySave } from "../persistence/migrations";
import type { Inventory, Save, Settlement } from "../game/types";
import { audio } from "../game/systems/audio";
audio.enabled = false;
beforeEach(() => setActivePinia(createPinia()));
function setup() {
  const g = useGame();
  g.newGame("building");
  g.orbit(0);
  g.land(0);
  g.exit();
  g.state.player.x = 40;
  g.state.player.y = 452;
  const terrain = new Terrain(g.planet, (g.state.changes[g.planet.id] ??= {}));
  const data = settlementFor(g.state, g.planet.id);
  return {
    g,
    terrain,
    data,
    ctx: {
      terrain,
      settlement: data,
      inventory: g.state.inventory,
      capacity: g.capacity,
      player: g.state.player,
      landingX: g.state.landingX,
    },
  };
}
describe("Florestas alienígenas", () => {
  it("reproduz árvores em coordenadas positivas e negativas, variando entre biomas e planetas", () => {
    const p = systemAt("forest", 0, 0).planets[0]!,
      a = new Terrain(p, {}),
      b = new Terrain(p, {});
    expect(treesInRange(p, a, -90, 150)).toEqual(treesInRange(p, b, -90, 150));
    const variants = new Set<string>();
    for (let kind = 0; kind < 6; kind++) {
      const planet = { ...p, kind, seed: p.seed + kind };
      const tree = treeAt(planet, new Terrain(planet, {}), 0)!;
      expect(tree.kind).toBe(kind);
      variants.add(`${tree.kind}:${tree.leaves}`);
    }
    expect(variants.size).toBe(6);
    expect(treesInRange(p, a, -90, 150).some((t) => t.x < 0)).toBe(true);
  });
  it("coleta madeira uma única vez, sem cortar à distância nem perder recurso por carga cheia", () => {
    const { g, terrain, data } = setup(),
      b = useConstruction(),
      tree = treeAt(g.planet, terrain, 0)!;
    g.state.player.x = 500;
    expect(b.harvest(tree)).toBe(false);
    g.state.player.x = 40;
    const inventory: Inventory = {};
    g.state.inventory = { woodBlock: 99 * 24 };
    expect(b.harvest(tree)).toBe(false);
    expect(data.cutTrees).toEqual([]);
    g.state.inventory = inventory;
    expect(b.harvest(tree)).toBe(true);
    expect(g.state.inventory.wood).toBe(tree.wood);
    expect(b.harvest(tree)).toBe(false);
    expect(g.state.inventory.wood).toBe(tree.wood);
    expect(
      treesInRange(g.planet, terrain, -8, 10, data.cutTrees).some(
        (t) => t.id === tree.id,
      ),
    ).toBe(false);
  });
});
describe("Construção e armazenamento transacionais", () => {
  it("fabrica lotes de peças à mão com custo exato", () => {
    const { g } = setup();
    g.state.inventory = { wood: 7, iron: 2 };
    g.make("woodBlock");
    expect(g.state.inventory).toEqual({ wood: 5, iron: 2, woodBlock: 4 });
    const inv = { wood: 1 };
    expect(
      craft(
        inv,
        recipes.find((r) => r.id === "woodWall")!,
        24,
        0,
      ),
    ).toBe(false);
    expect(inv).toEqual({ wood: 1 });
  });
  it("valida alcance, colisão, suporte e peças disponíveis antes de consumir", () => {
    const { ctx, g, data } = setup();
    g.state.inventory.woodBlock = 4;
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeUndefined();
    expect(g.state.inventory.woodBlock).toBe(3);
    expect(data.pieces["4,28"]?.kind).toBe("woodBlock");
    const before = JSON.stringify(g.state.inventory);
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 400, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 2, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 4, 29)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 4, 24)).toBeTruthy();
    expect(JSON.stringify(g.state.inventory)).toBe(before);
  });
  it("mantém paredes e peças em camadas separadas e devolve peças uma única vez", () => {
    const { ctx, g, data } = setup();
    g.state.inventory = { woodBlock: 2, woodWall: 2 };
    ctx.inventory = g.state.inventory;
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeUndefined();
    expect(placePiece(ctx, "woodWall", 4, 28)).toBeUndefined();
    expect(data.walls["4,28"]).toBe(true);
    expect(removePiece(ctx, 4, 28, true)).toBeUndefined();
    expect(data.pieces["4,28"]).toBeDefined();
    expect(removePiece(ctx, 4, 28)).toBeUndefined();
    const before = { ...g.state.inventory };
    expect(removePiece(ctx, 4, 28)).toBeTruthy();
    expect(g.state.inventory).toEqual(before);
  });
  it("não desmonta armário cheio; transferências não perdem nem duplicam recursos", () => {
    const { ctx, g, data } = setup();
    g.state.inventory = { cabinet: 1, wood: 20 };
    ctx.inventory = g.state.inventory;
    expect(placePiece(ctx, "cabinet", 4, 28)).toBeUndefined();
    const cabinet = data.cabinets["4,28"]!;
    expect(transfer(g.state.inventory, cabinet, "wood", 15, 16)).toBe(true);
    expect(g.state.inventory.wood).toBe(5);
    expect(cabinet.wood).toBe(15);
    expect(removePiece(ctx, 4, 28)).toContain("Esvazie");
    expect(transfer(cabinet, cabinet, "wood", 1, 16)).toBe(false);
    expect(transfer(cabinet, g.state.inventory, "wood", 15, 24)).toBe(true);
    expect(removePiece(ctx, 4, 28)).toBeUndefined();
    expect(g.state.inventory).toEqual({ wood: 20, cabinet: 1 });
    expect(data.cabinets["4,28"]).toBeUndefined();
  });
  it("recusa transferência sem espaço ou com quantidade inválida mantendo os dois lados", () => {
    const source: Inventory = { wood: 50 },
      dest: Inventory = { iron: 99 };
    expect(transfer(source, dest, "wood", 20, 1)).toBe(false);
    expect(transfer(source, dest, "wood", -1, 24)).toBe(false);
    expect(transfer(source, dest, "wood", 51, 24)).toBe(false);
    expect(source).toEqual({ wood: 50 });
    expect(dest).toEqual({ iron: 99 });
  });
  it("preserva o inventário quando não cabe a peça desmontada", () => {
    const { ctx, data } = setup();
    data.pieces["4,28"] = { kind: "woodBlock", facing: 1 };
    ctx.inventory = { iron: 99 };
    ctx.capacity = 1;
    expect(removePiece(ctx, 4, 28)).toContain("Carga cheia");
    expect(data.pieces["4,28"]).toBeDefined();
    expect(ctx.inventory).toEqual({ iron: 99 });
  });
  it("separa os armários por planeta e impede transferência com armário remoto", () => {
    const { g, data } = setup(),
      b = useConstruction();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 12 };
    expect(b.openCabinet("4,28")).toBe(true);
    const original = g.planet.id;
    g.state.systemX = 1;
    expect(b.moveItem("withdraw", "wood", 1)).toBe(false);
    expect(b.settlement.cabinets["4,28"]).toBeUndefined();
    g.state.systemX = 0;
    expect(g.planet.id).toBe(original);
    expect(b.settlement.cabinets["4,28"]).toEqual({ wood: 12 });
  });
});
describe("Física das casas e escadas", () => {
  it("pisos colidem, paredes e móveis não bloqueiam o personagem", () => {
    const { terrain, data } = setup();
    data.pieces["4,28"] = { kind: "woodBlock", facing: 1 };
    data.pieces["5,28"] = { kind: "cabinet", facing: 1 };
    data.walls["6,28"] = true;
    expect(solidCell(terrain, data, 4, 28)).toBe(true);
    expect(solidCell(terrain, data, 5, 28)).toBe(false);
    expect(solidCell(terrain, data, 6, 28)).toBe(false);
    const actor = stepSurface(
      { x: 72, y: 420, vy: 600, grounded: false },
      0,
      false,
      1,
      0.04,
      terrain,
      data,
    );
    expect(actor.y + 12).toBe(448);
    expect(actor.grounded).toBe(true);
  });
  it("permite subir uma escada e alcançar o piso superior sem pular", () => {
    const { terrain } = setup(),
      data = emptySettlement();
    for (let i = 0; i < 3; i++)
      data.pieces[`${4 + i},${28 - i}`] = { kind: "woodStairs", facing: 1 };
    data.pieces["7,26"] = { kind: "woodBlock", facing: 1 };
    let actor: Actor = { x: 50, y: 452, vy: 0, grounded: true };
    for (let i = 0; i < 58; i++)
      actor = stepSurface(actor, 1, false, 1, 0.016, terrain, data);
    expect(actor.x).toBeGreaterThan(120);
    expect(actor.y + 12).toBeCloseTo(416, 0);
  });
  it("escada invertida permite subir na direção oposta", () => {
    const { terrain } = setup(),
      data: Settlement = emptySettlement();
    data.pieces["4,28"] = { kind: "woodStairs", facing: -1 };
    data.pieces["3,28"] = { kind: "woodBlock", facing: 1 };
    let actor: Actor = { x: 90, y: 452, vy: 0, grounded: true };
    for (let i = 0; i < 26; i++)
      actor = stepSurface(actor, -1, false, 1, 0.016, terrain, data);
    expect(actor.x).toBeLessThan(60);
    expect(actor.y + 12).toBeCloseTo(448, 0);
  });
});
describe("Migração e persistência de assentamentos", () => {
  it("migra o banco real versão 1 preservando toda a partida antiga", async () => {
    const { g } = setup(),
      name = `legacy-${crypto.randomUUID()}`;
    const { settlements: omitted, ...rest } = JSON.parse(
      JSON.stringify(g.state),
    ) as Save;
    void omitted;
    const old: LegacySave = { ...rest, version: 1 };
    old.inventory = { wood: 17, iron: 9 };
    old.changes[g.planet.id] = { "4,29": 0 };
    old.visited.push("visited-star");
    const db1 = new Dexie(name);
    db1.version(1).stores({ saves: "id,updated" });
    await db1.table("saves").put({ id: "commander", data: old, updated: 123 });
    db1.close();
    const db2 = new SaveDatabase(name),
      migrated = await db2.read();
    expect(migrated).toEqual({ ...old, version: 4, settlements: {} });
    expect(db2.verno).toBe(4);
    await db2.delete();
  });
  it("reabre árvores cortadas, paredes, escadas e conteúdo de vários armários", async () => {
    const { g, data } = setup(),
      name = `build-${crypto.randomUUID()}`;
    data.cutTrees.push("tree:0");
    data.pieces["4,28"] = { kind: "woodStairs", facing: -1 };
    data.walls["6,28"] = true;
    data.pieces["7,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["7,28"] = { wood: 44, copper: 6 };
    const other = settlementFor(g.state, "another-planet");
    other.pieces["7,28"] = { kind: "cabinet", facing: 1 };
    other.cabinets["7,28"] = { iron: 15 };
    const db = new SaveDatabase(name);
    await db.write(g.state);
    db.close();
    const reopened = new SaveDatabase(name),
      saved = await reopened.read();
    expect(saved).toEqual(JSON.parse(JSON.stringify(g.state)));
    expect(saved!.settlements[g.planet.id]!.cabinets["7,28"]).toEqual({
      wood: 44,
      copper: 6,
    });
    expect(saved!.settlements["another-planet"]!.cabinets["7,28"]).toEqual({
      iron: 15,
    });
    await reopened.delete();
  });
  it("recusa versões futuras em vez de apagar progresso", () => {
    expect(() => migrateSave({ version: 99 } as unknown as Save)).toThrow(
      "incompatível",
    );
  });
});

describe("Retorno a bases planetárias", () => {
  it("mantém a casa e o armário após decolar, saltar e retornar ao planeta", async () => {
    const { g, data } = setup();
    data.cutTrees = ["tree:0"];
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 23, iron: 8 };
    data.walls["3,28"] = true;
    g.state.ship.hull = 100;
    g.state.upgrades = ["jump"];
    g.enter();
    g.takeoff();
    await g.jump(1, 0);
    g.orbit(0);
    g.land(0);
    g.exit();
    const b = useConstruction();
    expect(b.settlement.cabinets["4,28"]).toBeUndefined();
    g.enter();
    g.takeoff();
    await g.jump(0, 0);
    g.orbit(0);
    g.land(0);
    g.exit();
    expect(b.settlement.cabinets["4,28"]).toEqual({ wood: 23, iron: 8 });
    expect(b.settlement.cutTrees).toEqual(["tree:0"]);
    expect(b.settlement.walls["3,28"]).toBe(true);
  });
});

describe("Acesso à nave", () => {
  it("impede bloquear a saída do astronauta mesmo quando ele está longe do ponto de pouso", () => {
    const { ctx } = setup();
    ctx.player.x = 90;
    ctx.player.y = 452;
    ctx.inventory = { woodBlock: 1 };
    expect(placePiece(ctx, "woodBlock", 2, 28)).toContain("saída");
    expect(ctx.inventory.woodBlock).toBe(1);
  });
});

describe("Construção de escadas contínuas", () => {
  it("conecta degraus diagonais de três andares a um piso sem exigir andaime", () => {
    const { ctx } = setup();
    ctx.inventory = { woodStairs: 3, woodBlock: 1 };
    for (let i = 0; i < 3; i++)
      expect(placePiece(ctx, "woodStairs", 4 + i, 28 - i, 1)).toBeUndefined();
    expect(placePiece(ctx, "woodBlock", 7, 26)).toBeUndefined();
    expect(ctx.inventory).toEqual({});
  });
});
