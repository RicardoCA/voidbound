import { Texture, TextureLoader } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { emptySettlement } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import {
  SurfaceWorld3D,
  type SurfaceFrame,
} from "../game/rendering/SurfaceWorld3D";
import { systemAt } from "../universe/generator";

afterEach(() => vi.restoreAllMocks());

it.each([
  [960, 540],
  [390, 760],
])(
  "mapeia o ponteiro para o terreno 3D em uma tela de %i × %i",
  (width, height) => {
    vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
    const world = new SurfaceWorld3D();
    const terrain = new Terrain(systemAt("VOIDBOUND", 0, 0).planets[0]!, {
      "0,10": 1,
    });
    const frame: SurfaceFrame = {
      terrain,
      settlement: emptySettlement(),
      camera: { x: 0, y: 160 },
      light: 1,
      elapsed: 0,
      sunPhase: 0,
      facing: 1,
      stride: 0,
      animals: [],
      fruit: [],
      drops: [],
    };
    const pick = (y: number, snap: boolean) => {
      const projected = world.project(8, y, 0, width, height);
      return world.pointAt(
        (projected.x * 2) / width - 1,
        1 - (projected.y * 2) / height,
        snap,
      );
    };
    try {
      world.update(frame, width, height);
      expect(pick(167, true)).toMatchObject({ x: 0, y: 10 });
      expect(pick(158, true)).toMatchObject({ x: 0, y: 10 });
      expect(pick(158, false)).toMatchObject({ x: 0, y: 9 });
      terrain.remove(0, 10);
      world.update(frame, width, height);
      expect(pick(158, true)).toMatchObject({ x: 0, y: 9 });
    } finally {
      world.dispose();
    }
  },
);
