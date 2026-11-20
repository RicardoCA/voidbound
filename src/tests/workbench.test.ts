import "fake-indexeddb/auto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import {
  emptySettlement,
  placePiece,
  removePiece,
  settlementFor,
} from "../construction/building";
import { pieceAt } from "../construction/pieces";
import { solidSurfaceVoxel } from "../game/physics/surfaceDepth";
import { Terrain } from "../game/procedural/terrain";
import { migrateSave } from "../persistence/migrations";
afterEach(() => vi.restoreAllMocks());
function fixture() {
  setActivePinia(createPinia());
  const g = useGame();
  g.started = true;
  g.state.mode = "surface";
  g.state.player.x = 80;
  g.state.player.y = 456;
  g.state.player.surfaceZ = 48;
  const data = settlementFor(g.state, g.planet.id);
  data.pieces["5,28,3"] = { kind: "workbench", facing: 1, rotation: 0 };
  return { g, data, b: useConstruction() };
}
describe("bancada planetária", () => {
  it("é fabricada nas construções com 30 pedras, 50 madeiras e 100 ferros", () => {
    const { g } = fixture();
    g.state.backpack = { stone: 30, wood: 50, iron: 100 };
    g.make("workbench");
    expect(g.state.backpack).toEqual({ workbench: 1 });
  });
  it("interagir abre a fabricação e consome apenas os recursos da mochila", () => {
    const { g, b } = fixture();
    g.state.backpack = { iron: 6 };
    g.state.inventory = { iron: 99 };
    g.make("plate");
    expect(g.state.backpack).toEqual({ iron: 6 });
    expect(b.interactAt(6, 28, 3)).toBe(true);
    expect(g.panel).toBe("craft");
    expect(g.atWorkbench).toBe(true);
    g.make("plate");
    expect(g.state.backpack).toEqual({ iron: 3, plate: 1 });
    expect(g.state.inventory).toEqual({ iron: 99 });
  });
  it("não retira materiais da nave ou do armário para completar a receita", () => {
    const { g, data } = fixture();
    g.state.backpack = { iron: 2 };
    g.state.inventory = { iron: 100 };
    data.cabinets["4,28,3"] = { iron: 100 };
    g.openWorkbench("5,28,3");
    g.make("plate");
    expect(g.state.backpack).toEqual({ iron: 2 });
    expect(g.state.inventory.iron).toBe(100);
    expect(data.cabinets["4,28,3"]!.iron).toBe(100);
  });
  it("preserva ingredientes quando a mochila não comporta o resultado", () => {
    const { g } = fixture();
    g.state.backpack = { iron: 6, stone: 99 * 23 };
    g.openWorkbench("5,28,3");
    g.make("plate");
    expect(g.state.backpack).toEqual({ iron: 6, stone: 99 * 23 });
  });
  it.each(["longe", "removida", "outro-planeta", "pausa", "fechado"])(
    "bloqueia a fabricação quando a bancada está %s",
    (reason) => {
      const { g, data } = fixture();
      g.state.backpack = { iron: 6 };
      g.openWorkbench("5,28,3");
      if (reason === "longe") g.state.player.x += 200;
      if (reason === "removida") delete data.pieces["5,28,3"];
      if (reason === "outro-planeta") g.state.planetIndex = 1;
      if (reason === "pausa") g.paused = true;
      if (reason === "fechado") g.panel = "";
      g.make("plate");
      expect(g.state.backpack).toEqual({ iron: 6 });
    },
  );
  it("mantém restrições de projeto e desbloqueios", () => {
    const { g } = fixture();
    g.state.backpack = { circuit: 5, titanium: 4, crystal: 6, cell: 2 };
    g.openWorkbench("5,28,3");
    g.make("cargoScanner");
    expect(g.state.backpack.cargoScanner).toBeUndefined();
    expect(g.state.backpack.circuit).toBe(5);
    g.state.scannerBlueprints = ["cargoScanner"];
    g.make("cargoScanner");
    expect(g.state.backpack.cargoScanner).toBe(1);
  });
  it("ocupa dois blocos com colisão e retorna uma única bancada ao remover", () => {
    const { g } = fixture();
    const terrain = new Terrain(g.planet, {});
    vi.spyOn(terrain, "getAt").mockReturnValue(0);
    const settlement = emptySettlement();
    for (const x of [5, 6])
      settlement.pieces[`${x},29,3`] = { kind: "woodBlock", facing: 1 };
    const ctx = {
      terrain,
      settlement,
      inventory: { workbench: 1 },
      capacity: 24,
      player: { x: 60, y: 456, surfaceZ: 48 },
      depth: 3,
      rotation: 0,
      landingX: 100,
    };
    expect(placePiece(ctx, "workbench", 5, 28)).toBeUndefined();
    expect(pieceAt(settlement, 6, 28, 3)?.key).toBe("5,28,3");
    expect(solidSurfaceVoxel(terrain, settlement, 6, 28, 3)).toBe(true);
    expect(removePiece(ctx, 6, 28)).toBeUndefined();
    expect(ctx.inventory.workbench).toBe(1);
    expect(pieceAt(settlement, 5, 28, 3)).toBeUndefined();
  });
  it("salva a bancada sem persistir a autorização de interação", () => {
    const { g } = fixture();
    g.openWorkbench("5,28,3");
    const saved = migrateSave(JSON.parse(JSON.stringify(g.state)));
    expect(saved.settlements[g.planet.id]!.pieces["5,28,3"]!.kind).toBe(
      "workbench",
    );
    g.state = saved;
    expect(g.atWorkbench).toBe(false);
  });
});
