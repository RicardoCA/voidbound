import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { STONE_TILE, Terrain } from "../game/procedural/terrain";
import { treeAt, treesInRange } from "../game/procedural/trees";
import { systemAt } from "../universe/generator";
import {
  emptySettlement,
  placePiece,
  removePiece,
  settlementFor,
  transfer,
} from "../construction/building";
import {
  stepClimb,
  stepSurface,
  solidCell,
  type Actor,
} from "../game/physics/surface";
import { craft, recipes } from "../crafting/recipes";
import { listBases } from "../construction/catalog";
import { SaveDatabase } from "../persistence/database";
import { migrateSave, type LegacySave } from "../persistence/migrations";
import {
  items,
  type Inventory,
  type Save,
  type Settlement,
} from "../game/types";
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
      inventory: g.state.backpack,
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
    g.state.backpack = { woodBlock: 99 * 24 };
    expect(b.harvest(tree)).toBe(false);
    expect(data.cutTrees).toEqual([]);
    g.state.backpack = inventory;
    expect(b.harvest(tree)).toBe(true);
    expect(g.state.backpack.wood).toBe(tree.wood);
    expect(b.harvest(tree)).toBe(false);
    expect(g.state.backpack.wood).toBe(tree.wood);
    expect(
      treesInRange(g.planet, terrain, -8, 10, data.cutTrees).some(
        (t) => t.id === tree.id,
      ),
    ).toBe(false);
  });
});
describe("Construção e armazenamento transacionais", () => {
  it("minera pedra em terreno rochoso e usa pedra na parede", () => {
    const { g } = setup();
    const terrain = new Terrain(g.planet, g.state.changes[g.planet.id]!);
    const other = new Terrain({ ...g.planet, kind: 1 }, {});
    expect(other.chunk(0).includes(STONE_TILE)).toBe(false);
    g.state.backpack.silicon = 3;
    g.make("stoneWall");
    expect(g.state.backpack).toEqual({ silicon: 3 });
    const deposits = [];
    for (let x = -8; x <= 8; x++)
      for (let y = 29; y <= 31; y++)
        if (terrain.get(x, y) === STONE_TILE) deposits.push({ x, y });
    expect(deposits.length).toBeGreaterThanOrEqual(3);
    for (const { x, y } of deposits.slice(0, 3)) {
      expect(g.mineTerrain(terrain, x, y)).toBe(true);
      expect(g.mineTerrain(terrain, x, y)).toBe(false);
    }
    g.make("stoneWall");
    expect(g.state.backpack).toEqual({ silicon: 3, stoneWall: 4 });
    const restored = migrateSave(g.state);
    const terrainAfterSave = new Terrain(
      g.planet,
      restored.changes[g.planet.id]!,
    );
    for (const { x, y } of deposits.slice(0, 3))
      expect(terrainAfterSave.get(x, y)).toBe(0);
  });
  it("fabrica lotes de peças à mão com custo exato", () => {
    const { g } = setup();
    g.state.backpack = { wood: 7, iron: 2 };
    g.make("woodBlock");
    expect(g.state.backpack).toEqual({ wood: 5, iron: 2, woodBlock: 4 });
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
    g.state.backpack.woodBlock = 4;
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeUndefined();
    expect(g.state.backpack.woodBlock).toBe(3);
    expect(data.pieces["4,28"]?.kind).toBe("woodBlock");
    const before = JSON.stringify(g.state.backpack);
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 400, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 2, 28)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 4, 29)).toBeTruthy();
    expect(placePiece(ctx, "woodBlock", 4, 24)).toBeTruthy();
    expect(JSON.stringify(g.state.backpack)).toBe(before);
  });
  it("mantém paredes e peças em camadas separadas e devolve peças uma única vez", () => {
    const { ctx, g, data } = setup();
    g.state.backpack = { woodBlock: 2, woodWall: 2 };
    ctx.inventory = g.state.backpack;
    expect(placePiece(ctx, "woodBlock", 4, 28)).toBeUndefined();
    expect(placePiece(ctx, "woodWall", 4, 28)).toBeUndefined();
    expect(data.walls["4,28"]).toBe(true);
    expect(removePiece(ctx, 4, 28, true)).toBeUndefined();
    expect(data.pieces["4,28"]).toBeDefined();
    expect(removePiece(ctx, 4, 28)).toBeUndefined();
    const before = { ...g.state.backpack };
    expect(removePiece(ctx, 4, 28)).toBeTruthy();
    expect(g.state.backpack).toEqual(before);
  });
  it("não desmonta armário cheio; transferências não perdem nem duplicam recursos", () => {
    const { ctx, g, data } = setup();
    g.state.backpack = { cabinet: 1, wood: 20 };
    ctx.inventory = g.state.backpack;
    expect(placePiece(ctx, "cabinet", 4, 28)).toBeUndefined();
    const cabinet = data.cabinets["4,28"]!;
    expect(transfer(g.state.backpack, cabinet, "wood", 15, 16)).toBe(true);
    expect(g.state.backpack.wood).toBe(5);
    expect(cabinet.wood).toBe(15);
    expect(removePiece(ctx, 4, 28)).toContain("Esvazie");
    expect(transfer(cabinet, cabinet, "wood", 1, 16)).toBe(false);
    expect(transfer(cabinet, g.state.backpack, "wood", 15, 24)).toBe(true);
    expect(removePiece(ctx, 4, 28)).toBeUndefined();
    expect(g.state.backpack).toEqual({ wood: 20, cabinet: 1 });
    expect(data.cabinets["4,28"]).toBeUndefined();
  });
  it.each([
    ["cabinetDouble", 2, 32],
    ["cabinetTriple", 3, 48],
  ] as const)(
    "fabrica e instala %s com o tamanho e a capacidade corretos",
    async (kind, width, capacity) => {
      const { ctx, g, data } = setup();
      const b = useConstruction();
      Object.assign(g.state.backpack, { wood: width * 6, iron: width * 2 });
      g.make(kind);
      expect(g.state.backpack).toEqual({ [kind]: 1 });
      expect(placePiece(ctx, kind, 4, 28)).toBeUndefined();
      const edge = 4 + width - 1;
      expect(b.cabinetAt(edge, 28)).toBe(true);
      expect(placePiece(ctx, "woodBlock", edge, 28)).toContain("Já existe");
      expect(b.interactAt(edge, 28)).toBe(true);
      expect(b.containerCapacity).toBe(capacity);
      data.cabinets["4,28"]!.iron = items.iron.stack * capacity - 1;
      g.state.backpack.iron = 2;
      expect(b.moveItem("deposit", "iron", 2)).toBe(false);
      expect(b.moveItem("deposit", "iron", 1)).toBe(true);
      expect(removePiece(ctx, edge, 28)).toContain("Esvazie");
      const db = new SaveDatabase(`large-cabinet-${crypto.randomUUID()}`);
      try {
        await db.write(g.state);
        const saved = (await db.read())!;
        expect(listBases(saved)[0]?.cabinets[0]).toMatchObject({
          kind,
          capacity,
          usedSlots: capacity,
          inventory: { iron: items.iron.stack * capacity },
        });
      } finally {
        await db.delete();
      }
    },
  );
  it("fabrica gravetos na nave e monta uma passagem vertical com alçapão", () => {
    const { ctx, g, data, terrain } = setup();
    const b = useConstruction();
    g.state.inventory.wood = 1;
    g.make("stick");
    expect(g.state.inventory).toEqual({ wood: 1 });
    g.enter();
    g.make("stick");
    expect(g.state.inventory).toEqual({ stick: 8 });
    expect(g.moveCargo(false, "stick", 8)).toBe(true);
    g.exit();
    g.state.player.x = 72;
    g.state.player.y = 452;
    Object.assign(g.state.backpack, { wood: 3, iron: 1, woodBlock: 1 });
    g.make("stickLadder");
    g.make("stickLadder");
    g.make("woodHatch");
    expect(placePiece(ctx, "stickLadder", 4, 28)).toBeUndefined();
    expect(placePiece(ctx, "stickLadder", 4, 27)).toBeUndefined();
    expect(placePiece(ctx, "woodHatch", 4, 26)).toBeUndefined();
    expect(placePiece(ctx, "woodBlock", 5, 26)).toBeUndefined();

    function climb(from: { x: number; y: number }, vertical: number) {
      let position = from;
      for (let frame = 0; frame < 100; frame++)
        position =
          stepClimb(position, 4, vertical, 0.02, terrain, data) ?? position;
      return position;
    }
    expect(
      stepClimb({ x: 88, y: 452 }, undefined, -1, 0.02, terrain, data),
    ).toMatchObject({ x: 72 });
    expect(b.interactAt(4, 28)).toBe(true);
    expect(b.climbingColumn).toBe(4);
    const below = climb(g.state.player, -1);
    expect(below.y).toBeGreaterThanOrEqual(443.9);
    expect(solidCell(terrain, data, 4, 26)).toBe(true);
    Object.assign(g.state.player, below);
    expect(b.toggleDoor("4,26")).toBe(true);
    expect(solidCell(terrain, data, 4, 26)).toBe(false);
    const upstairs = climb(below, -1);
    expect(upstairs.y).toBe(26 * 16 - 12);
    const walked = stepSurface(
      { ...upstairs, vy: 0, grounded: false },
      1,
      false,
      1,
      0.18,
      terrain,
      data,
    );
    expect(walked.grounded).toBe(true);
    expect(climb(upstairs, 1).y).toBeGreaterThan(440);
    Object.assign(g.state.player, { x: 72, y: 430 });
    expect(b.toggleDoor("4,26")).toBe(false);
    expect(
      migrateSave(g.state).settlements[g.planet.id]?.pieces["4,26"]?.open,
    ).toBe(true);
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
  }, 15_000);
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
