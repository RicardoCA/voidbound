import { treeAt } from "../game/procedural/trees";
import { InstancedMesh, Matrix4, Texture, TextureLoader } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { emptySettlement, placementError, placePiece, removePiece } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import {
  solidSurfaceVoxel,
  surfaceWallBlocks,
  stepSurfaceDepth,
} from "../game/physics/surfaceDepth";
import {
  SurfaceWorld3D,
  type SurfaceFrame,
} from "../game/rendering/SurfaceWorld3D";
import { systemAt } from "../universe/generator";

afterEach(() => vi.restoreAllMocks());

const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;

it.each([
  [960, 540],
  [390, 760],
])(
  "seleciona a face e o espaço adjacente na visão em primeira pessoa %i × %i",
  (width, height) => {
    vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
    const world = new SurfaceWorld3D();
    const terrain = new Terrain(planet, { "0,9,-2": 2 });
    const frame: SurfaceFrame = {
      terrain,
      settlement: emptySettlement(),
      camera: { x: 8, y: 153, z: 16, yaw: 0, pitch: 0 },
      revision: 0,
      light: 1,
      elapsed: 0,
      sunPhase: 0,
      facing: 1,
      stride: 0,
      animals: [],
      fruit: [],
      drops: [],
    };
    try {
      world.update(frame, width, height);
      expect(world.pointAt(0, 0, true)).toMatchObject({
        x: 0,
        y: 9,
        depth: -2,
      });
      expect(world.pointAt(0, 0, false)).toMatchObject({
        x: 0,
        y: 9,
        depth: -1,
      });
      const hasBlockMesh = () => {
        let found = false;
        const transform = new Matrix4();
        world.scene.traverse((object) => {
          if (!(object instanceof InstancedMesh)) return;
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, transform);
            const [x, y, z] = transform.elements.slice(12, 15);
            if (x === 8 && y === -152 && z === -32) found = true;
          }
        });
        return found;
      };
      expect(hasBlockMesh()).toBe(true);
      terrain.remove(0, 9, -2);
      world.update(frame, width, height);
      expect(hasBlockMesh()).toBe(false);
      expect(world.pointAt(0, 0, true)).toBeUndefined();
    } finally {
      world.dispose();
    }
  },
);

it("preserva as escavações antigas e isola os blocos construídos por profundidade", () => {
  const terrain = new Terrain(planet, { "0,29": 0 });
  const settlement = {
    ...emptySettlement(),
    depthBlocks: { "0,27,1": true } as const,
  };
  expect(terrain.getAt(0, 29, 0)).toBe(0);
  expect(solidSurfaceVoxel(terrain, settlement, 0, 27, 1)).toBe(true);
  expect(solidSurfaceVoxel(terrain, settlement, 0, 27, 0)).toBe(false);
  const actor = { x: 8, y: 29 * 16 - 12, z: 2, vy: 0, grounded: true };
  const move = stepSurfaceDepth(actor, 0, 8, false, 1, 0.04, (x, y, z) =>
    solidSurfaceVoxel(terrain, settlement, x, y, z),
  );
  expect(move.z).toBe(actor.z);
});

it("identifica a face minerável na faixa original sem perder a profundidade zero", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, { "0,9": 3 });
  try {
    world.update(
      {
        terrain,
        settlement: emptySettlement(),
        camera: { x: 8, y: 153, z: 24, yaw: 0, pitch: 0 },
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
    const hit = world.pointAt(0, 0, true);
    expect(hit).toMatchObject({ x: 0, y: 9, depth: 0, terrain: true });
    expect(hit!.distance).toBeGreaterThanOrEqual(16);
    expect(hit!.distance).toBeLessThan(16.7);
  } finally {
    world.dispose();
  }
});

it("salta do piso na física 3D após o primeiro contato com o chão", () => {
  const actor = { x: 8, y: 148, z: 0, vy: 0, grounded: false };
  const solid = (_x: number, y: number) => y >= 10;
  const grounded = stepSurfaceDepth(actor, 0, 0, false, 1, 0.04, solid);
  expect(grounded.grounded).toBe(true);
  const jumping = stepSurfaceDepth(grounded, 0, 0, true, 1, 0.04, solid);
  expect(jumping.y).toBeLessThan(grounded.y);
  expect(jumping.grounded).toBe(false);
});

it("seleciona o tronco pela mira 3D e remove o alvo após o corte", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, {});
  const tree = treeAt(planet, terrain, 0)!;
  const settlement = emptySettlement();
  const frame: SurfaceFrame = {
    terrain,
    settlement,
    revision: 0,
    light: 1,
    elapsed: 0,
    sunPhase: 0,
    facing: 1,
    stride: 0,
    animals: [],
    fruit: [],
    drops: [],
    camera: {
      x: tree.x * 16 + 8,
      y: tree.ground * 16 - 15,
      z: 27,
      yaw: 0,
      pitch: 0,
    },
  };
  try {
    world.update(frame, 960, 540);
    expect(world.pointAt(0, 0, true)?.treeId).toBe(tree.id);
    settlement.cutTrees.push(tree.id);
    world.update(frame, 960, 540);
    expect(world.pointAt(0, 0, true)?.treeId).not.toBe(tree.id);
  } finally {
    world.dispose();
  }
});

it.each([true, "stoneWall", "metalWall"] as const)(
  "impede atravessar a parede %s na posição da malha",
  (wall) => {
    const settlement = emptySettlement();
    settlement.walls["0,9"] = wall;
    const actor = { x: 8, y: 148, z: 2, vy: 0, grounded: true };
    const step = stepSurfaceDepth(
      actor,
      0,
      -4,
      false,
      1,
      0.04,
      (_x, y) => y >= 10,
      (x, y, z) => surfaceWallBlocks(settlement, x, y, z),
    );
    expect(step.z).toBe(actor.z);
    expect(surfaceWallBlocks(settlement, 8, 148, 8)).toBe(false);
  },
);

it("instala e desmonta um armário sobre piso de madeira fora da faixa original", () => {
  const terrain = new Terrain(planet, { "0,8,3": 0, "0,9,3": 0 });
  const settlement = emptySettlement();
  settlement.depthBlocks = { "0,9,3": true };
  const ctx = {
    terrain, settlement, inventory: { cabinet: 1 }, capacity: 24,
    player: { x: -30, y: 136, surfaceZ: 48 }, landingX: 100, depth: 3, rotation: 1,
  };
  expect(placementError(ctx, "cabinet", 0, 8)).toBeUndefined();
  expect(placePiece(ctx, "cabinet", 0, 8)).toBeUndefined();
  expect(settlement.pieces["0,8,3"]).toMatchObject({ kind: "cabinet", rotation: 1 });
  expect(settlement.cabinets["0,8,3"]).toEqual({});
  expect(removePiece(ctx, 0, 8)).toBeUndefined();
  expect(ctx.inventory.cabinet).toBe(1);
  expect(settlement.depthBlocks["0,9,3"]).toBe(true);
});

it("alinha a colisão de paredes e portas giradas no eixo de profundidade", () => {
  const settlement = emptySettlement();
  settlement.depthWalls = { "0,8,3": "metalWall" };
  settlement.wallRotations = { "0,8,3": 1 };
  settlement.pieces["0,8,4"] = { kind: "woodDoor", facing: 1, rotation: 1, open: false };
  expect(surfaceWallBlocks(settlement, 2, 136, 48)).toBe(true);
  expect(surfaceWallBlocks(settlement, 11, 136, 48)).toBe(false);
  expect(surfaceWallBlocks(settlement, 2, 120, 64)).toBe(true);
  settlement.pieces["0,8,4"]!.open = true;
  expect(surfaceWallBlocks(settlement, 2, 120, 64)).toBe(false);
});
