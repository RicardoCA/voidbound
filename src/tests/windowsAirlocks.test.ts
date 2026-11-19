import "fake-indexeddb/auto";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Texture,
  TextureLoader,
} from "three";
import {
  emptySettlement,
  placePiece,
  placementError,
  removePiece,
} from "../construction/building";
import { airlockPartner, toggleAirlockDoor } from "../construction/airlock";
import { analyzeSpatialRoom } from "../construction/habitat";
import { keyAt, pieceAt } from "../construction/pieces";
import {
  solidSurfaceVoxel,
  surfaceWallBlocks,
} from "../game/physics/surfaceDepth";
import { SurfaceWorld3D } from "../game/rendering/SurfaceWorld3D";
import { Terrain } from "../game/procedural/terrain";
import { systemAt } from "../universe/generator";
import { migrateSave } from "../persistence/migrations";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;
afterEach(() => vi.restoreAllMocks());
function emptyTerrain() {
  const terrain = new Terrain(planet, {});
  vi.spyOn(terrain, "getAt").mockReturnValue(0);
  return terrain;
}
function rooms() {
  const terrain = emptyTerrain(),
    data = emptySettlement();
  for (let x = 0; x <= 8; x++)
    for (let y = 20; y <= 24; y++)
      for (let z = 0; z <= 4; z++)
        if (
          x === 0 ||
          x === 4 ||
          x === 8 ||
          y === 20 ||
          y === 24 ||
          z === 0 ||
          z === 4
        )
          data.pieces[keyAt(x, y, z)] = { kind: "woodBlock", facing: 1 };
  for (const x of [4, 8]) {
    delete data.pieces[keyAt(x, 22, 2)];
    data.pieces[keyAt(x, 23, 2)] = {
      kind: "airlockDoor",
      facing: 1,
      rotation: 1,
      open: false,
    };
  }
  data.pieces[keyAt(2, 22, 0)] = { kind: "window", facing: 1, rotation: 0 };
  return { terrain, data };
}
describe("janelas vedadas", () => {
  it.each([0, 1, 2, 3])(
    "ocupa um vão livre, gira e devolve a peça ao remover (%i)",
    (rotation) => {
      const terrain = emptyTerrain(),
        settlement = emptySettlement();
      settlement.pieces["0,9,3"] = { kind: "woodBlock", facing: 1 };
      const ctx = {
        terrain,
        settlement,
        inventory: { window: 1, woodWall: 1 },
        capacity: 24,
        player: { x: -25, y: 136, surfaceZ: 48 },
        landingX: 100,
        depth: 3,
        rotation,
      };
      settlement.depthWalls = { "0,8,3": true };
      expect(placementError(ctx, "window", 0, 8)).toContain("vão livre");
      delete settlement.depthWalls["0,8,3"];
      settlement.pieces["0,8,3"] = { kind: "woodBlock", facing: 1 };
      expect(placementError(ctx, "window", 0, 8)).toBeTruthy();
      delete settlement.pieces["0,8,3"];
      expect(placePiece(ctx, "window", 0, 8)).toBeUndefined();
      expect(settlement.pieces["0,8,3"]).toMatchObject({
        kind: "window",
        rotation,
      });
      expect(placementError(ctx, "woodWall", 0, 8)).toContain("vão livre");
      expect(removePiece(ctx, 0, 8)).toBeUndefined();
      expect(ctx.inventory.window).toBe(1);
    },
  );
  it("veda o cômodo e abre uma fuga quando removida", () => {
    const { terrain, data } = rooms();
    expect(analyzeSpatialRoom(terrain, data, 2, 22, 2).sealed).toBe(true);
    delete data.pieces[keyAt(2, 22, 0)];
    expect(analyzeSpatialRoom(terrain, data, 2, 22, 2).sealed).toBe(false);
  });
  it("tem colisão apenas no painel de vidro, respeitando a rotação", () => {
    const terrain = emptyTerrain(),
      data = emptySettlement();
    data.pieces["0,8,3"] = { kind: "window", facing: 1, rotation: 1 };
    expect(solidSurfaceVoxel(terrain, data, 0, 8, 3)).toBe(false);
    expect(surfaceWallBlocks(data, 2, 136, 48)).toBe(true);
    expect(surfaceWallBlocks(data, 11, 136, 48)).toBe(false);
  });
  it("renderiza vidro transparente dos dois lados", () => {
    vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
    const terrain = emptyTerrain(),
      settlement = emptySettlement(),
      world = new SurfaceWorld3D();
    settlement.pieces["0,8,3"] = { kind: "window", facing: 1, rotation: 1 };
    try {
      world.update(
        {
          terrain,
          settlement,
          camera: { x: 8, y: 136, z: 48, yaw: 0, pitch: 0 },
          revision: 0,
          light: 1,
          elapsed: 0,
          sunPhase: 0,
          facing: 1,
          stride: 0,
          animals: [],
          fruit: [],
          drops: [],
        },
        960,
        540,
      );
      const glass: MeshStandardMaterial[] = [];
      world.scene.traverse((object) => {
        if (
          object instanceof Mesh &&
          object.material instanceof MeshStandardMaterial &&
          object.material.transparent
        )
          glass.push(object.material);
      });
      expect(
        glass.some(
          (material) =>
            material.side === DoubleSide &&
            material.opacity < 0.3 &&
            !material.depthWrite,
        ),
      ).toBe(true);
    } finally {
      world.dispose();
    }
  });
});
describe("antecâmara de duas portas", () => {
  it("fecha a porta externa antes de abrir a interna e mantém a sala vedada", () => {
    const { terrain, data } = rooms(),
      actor = { x: 32, y: 352, surfaceZ: 32 };
    const inner = keyAt(4, 23, 2),
      outer = keyAt(8, 23, 2);
    expect(airlockPartner(data, inner)).toBe(outer);
    expect(pieceAt(data, 4, 22, 2)?.key).toBe(inner);
    expect(toggleAirlockDoor(data, outer, actor)).toBeUndefined();
    expect(data.pieces[outer]!.open).toBe(true);
    expect(analyzeSpatialRoom(terrain, data, 2, 22, 2).sealed).toBe(true);
    expect(analyzeSpatialRoom(terrain, data, 6, 22, 2).sealed).toBe(false);
    expect(toggleAirlockDoor(data, inner, actor)).toBeUndefined();
    expect(data.pieces[outer]!.open).toBe(false);
    expect(data.pieces[inner]!.open).toBe(true);
    expect(analyzeSpatialRoom(terrain, data, 2, 22, 2).sealed).toBe(true);
    expect(surfaceWallBlocks(data, 66, 360, 32)).toBe(false);
    expect(surfaceWallBlocks(data, 130, 360, 32)).toBe(true);
  });
  it("não fecha a outra porta sobre o jogador nem abre as duas", () => {
    const { data } = rooms(),
      inner = keyAt(4, 23, 2),
      outer = keyAt(8, 23, 2);
    data.pieces[outer]!.open = true;
    expect(
      toggleAirlockDoor(data, inner, { x: 136, y: 367, surfaceZ: 32 }),
    ).toContain("Saia do vão");
    expect(data.pieces[inner]!.open).toBe(false);
    expect(data.pieces[outer]!.open).toBe(true);
  });
  it("preserva janelas, rotação e estado das duas portas no save", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const { data } = rooms();
    g.state.settlements[g.planet.id] = data;
    data.pieces[keyAt(4, 23, 2)]!.open = true;
    expect(
      migrateSave(JSON.parse(JSON.stringify(g.state))).settlements[g.planet.id],
    ).toEqual(data);
  });
});
