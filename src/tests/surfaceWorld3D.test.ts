import { Texture, TextureLoader } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { emptySettlement } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import {
  solidSurfaceVoxel,
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
      terrain.remove(0, 9, -2);
      world.update({ ...frame, revision: 1 }, width, height);
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
