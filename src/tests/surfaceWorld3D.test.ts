import { fallbackLandedHull, landedHullOverlap, landingSideExit } from "../game/physics/landedShip";
import { advancePowerNetwork, powerNetwork } from "../construction/habitat";
import { treeAt } from "../game/procedural/trees";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Texture, TextureLoader, Vector3 } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { buildItems, emptySettlement, placementError, placePiece, removePiece } from "../construction/building";
import { LAVA_TILE, Terrain, WATER_TILE } from "../game/procedural/terrain";
import {
  solidSurfaceVoxel,
  surfaceWallBlocks,
  stepSurfaceDepth,
  touchesSurfaceLiquid,
} from "../game/physics/surfaceDepth";
import {
  SurfaceWorld3D,
  type SurfaceFrame,
} from "../game/rendering/SurfaceWorld3D";
import { systemAt } from "../universe/generator";

afterEach(() => vi.restoreAllMocks());

const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;

it("mira na cerca para instalar um teto com espaço livre abaixo", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const settlement = emptySettlement();
  settlement.pieces["0,9,-1"] = { kind: "woodFence", facing: 1, rotation: 0 };
  try {
    world.update({
      terrain: new Terrain(planet, {}), settlement, selectedConstruction: "cropRoof",
      camera: { x: 8, y: 158.5, z: 0, yaw: 0, pitch: 0 },
      revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
      animals: [], fruit: [], drops: [],
    }, 960, 540);
    expect(world.pointAt(0, 0, false)).toMatchObject({ x: 0, y: 7, depth: -1 });
  } finally {
    world.dispose();
  }
});

it("desenha água e lava, mantém passagem livre e permite mirar no minério ao fundo", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, {
    "0,9,-1": WATER_TILE, "0,9,-2": LAVA_TILE, "0,9,-3": 2,
  });
  const settlement = emptySettlement();
  try {
    world.update({
      terrain, settlement, camera: { x: 8, y: 159.5, z: 16, yaw: 0, pitch: 0 },
      revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
      animals: [], fruit: [], drops: [],
    }, 960, 540);
    expect(world.scene.getObjectByName("water")).toBeInstanceOf(InstancedMesh);
    expect(world.scene.getObjectByName("lava")).toBeInstanceOf(InstancedMesh);
    expect(solidSurfaceVoxel(terrain, settlement, 0, 9, -1)).toBe(false);
    expect(solidSurfaceVoxel(terrain, settlement, 0, 9, -2)).toBe(false);
    expect(touchesSurfaceLiquid(terrain, { x: 8, y: 148, surfaceZ: -32 }, LAVA_TILE, true)).toBe(true);
    expect(touchesSurfaceLiquid(terrain, { x: 8, y: 130, surfaceZ: -32 }, LAVA_TILE, true)).toBe(false);
    expect(world.pointAt(0, 0, true)).toMatchObject({ x: 0, y: 9, depth: -3, terrain: true });
    expect(world.pointAt(0, 0, true, false, true)).toMatchObject({ x: 0, y: 9, depth: -1 });
  } finally {
    world.dispose();
  }
});

it("gera rios e mares nos biomas úmidos e concentra lava em profundidade", () => {
  const rocky = new Terrain({ ...planet, kind: 0 }, {});
  const ocean = new Terrain({ ...planet, kind: 5 }, {});
  const desert = new Terrain({ ...planet, kind: 1 }, {});
  const volcano = new Terrain({ ...planet, kind: 4 }, {});
  const columns = Array.from({ length: 144 }, (_, i) => i - 48);
  const isWet = (terrain: Terrain, x: number, depth: number) =>
    terrain.getAt(x, terrain.heightAt(x, depth) - 1, depth) === WATER_TILE;
  expect(columns.some(x => isWet(rocky, x, -12))).toBe(true);
  expect(columns.filter(x => ocean.getAt(x, 28, -12) === WATER_TILE).length).toBeGreaterThan(12);
  expect(columns.some(x => isWet(desert, x, -12))).toBe(false);
  for (const pad of [0, 24, 48]) expect(isWet(ocean, pad, 0)).toBe(false);
  const rows = Array.from({ length: 63 }, (_, y) => y);
  const lavaDepths = columns.flatMap(x => rows.filter(y => volcano.getAt(x, y, -3) === LAVA_TILE));
  expect(lavaDepths.length).toBeGreaterThan(0);
  expect(Math.min(...lavaDepths)).toBeGreaterThanOrEqual(45);
});

it("oculta uma peça atrás de parede opaca e volta a desenhá-la pela abertura", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const settlement = emptySettlement();
  const wall = "0,9,-1";
  settlement.depthWalls = { [wall]: true };
  settlement.pieces["0,9,-3"] = { kind: "campfire", facing: 1 };
  const frame: SurfaceFrame = {
    terrain: new Terrain(planet, {}), settlement,
    camera: { x: 8, y: 159.5, z: 0, yaw: 0, pitch: 0 },
    revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
    animals: [], fruit: [], drops: [],
  };
  try {
    world.update(frame, 960, 540);
    const campfire = world.scene.children.find((node) => node.userData.cell?.depth === -3);
    expect(campfire?.visible).toBe(false);
    expect(world.pointAt(0, 0, true)?.wallFace).toBe(0);

    frame.camera.x = 36;
    frame.camera.yaw = Math.atan2(28, 44);
    world.update(frame, 960, 540);
    expect(campfire?.visible).toBe(true);

    frame.camera.x = 8;
    frame.camera.yaw = 0;
    delete settlement.depthWalls[wall];
    settlement.pieces[wall] = { kind: "window", facing: 1, rotation: 0 };
    world.update(frame, 960, 540);
    expect(campfire?.visible).toBe(true);
  } finally {
    world.dispose();
  }
});

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
      frame.cursor = { x: 0, y: 9, depth: -1, valid: true, kind: "woodBlock" };
      world.update(frame, width, height);
      expect(world.pointAt(0, 0, false)).toBeUndefined();
      expect(world.pointAt(0, 0, false, true)).toMatchObject({ x: 0, y: 9, depth: -1 });
      frame.cursor.valid = false;
      world.update(frame, width, height);
      expect(world.pointAt(0, 0, false, true)).toBeUndefined();
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

it("fecha cantos com duas paredes na mesma célula e desmonta apenas a face selecionada", () => {
  const terrain = new Terrain(planet, { "0,8,3": 0, "0,9,3": 2 });
  const settlement = emptySettlement();
  const ctx = {
    terrain, settlement, inventory: { woodWall: 2, metalWall: 1 }, capacity: 24,
    player: { x: -30, y: 136, surfaceZ: 48 }, landingX: 100, depth: 3, rotation: 0,
  };
  expect(placePiece(ctx, "woodWall", 0, 8)).toBeUndefined();
  expect(placePiece(ctx, "woodWall", 0, 8)).toBe("Já existe uma peça nesta camada.");
  expect(placePiece({ ...ctx, rotation: 1 }, "metalWall", 0, 8)).toBeUndefined();
  expect(surfaceWallBlocks(settlement, 2, 136, 48)).toBe(true);
  expect(removePiece(ctx, 0, 8, true, 0)).toBeUndefined();
  expect(ctx.inventory.woodWall).toBe(2);
  expect(settlement.depthWalls?.["0,8,3"]).toBe("metalWall");
  expect(settlement.wallRotations?.["0,8,3"]).toBe(1);
});

it.each(buildItems)("instala %s na base fora da faixa original", (kind) => {
  const settlement = emptySettlement();
  settlement.depthBlocks = { "0,9,3": true, "1,9,3": true, "2,9,3": true };
  if (kind === "picture") settlement.depthWalls = { "0,8,3": true };
  const terrain = new Terrain(planet, { "0,7,3": 0, "0,8,3": 0, "1,8,3": 0, "2,8,3": 0 });
  expect(placePiece({
    terrain, settlement, inventory: { [kind]: 1 }, capacity: 24,
    player: { x: -30, y: 136, surfaceZ: 48 }, landingX: 100, depth: 3, rotation: 0,
  }, kind, 0, 8)).toBeUndefined();
});

it("alimenta geladeira e gerador numa base cercada em três dimensões", () => {
  const settlement = emptySettlement();
  const terrain = new Terrain(planet, { "0,8,3": 0, "0,7,3": 0, "1,8,3": 0 });
  settlement.depthBlocks = { "0,9,3": true, "0,7,3": true };
  settlement.depthWalls = { "0,8,3": true };
  settlement.cornerWalls = { "0,8,3": { 1: true, 2: true, 3: true } };
  settlement.pieces = {
    "0,8,3": { kind: "oxygenGenerator", facing: 1, rotation: 0 },
    "1,8,3": { kind: "fridge", facing: 1 },
    "2,8,3": { kind: "battery", facing: 1 },
    "0,6,3": { kind: "solarPanel", facing: 1 },
  };
  const network = powerNetwork(terrain, settlement);
  expect(network.generators[0]?.room.sealed).toBe(true);
  expect(network.batteries[0]?.panels).toBe(1);
  advancePowerNetwork(settlement, network, 0, 30);
  expect(settlement.pieces["0,8,3"]?.oxygen).toBeGreaterThan(0);
  expect(settlement.pieces["1,8,3"]?.powered).toBe(true);
  delete settlement.cornerWalls["0,8,3"]![3];
  expect(powerNetwork(terrain, settlement).generators[0]?.room.sealed).toBe(false);
});

it("instancia o kit Blender na superfície e atualiza a célula depois de minerar", async () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const template = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const voxel = new Mesh(geometry, material);
  voxel.name = "voxel_2_1";
  template.add(voxel);
  const load = vi.fn<(name: string) => Promise<Group>>(async () => template);
  const world = new SurfaceWorld3D(load);
  const terrain = new Terrain(planet, {});
  const row = terrain.heightAt(0, -2);
  terrain.changes[terrain.keyAt(0, row, -2)] = 2;
  const frame: SurfaceFrame = {
    terrain, settlement: emptySettlement(),
    camera: { x: 8, y: 460, z: 16, yaw: 0, pitch: 0 },
    revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
    animals: [], fruit: [], drops: [],
  };
  const hasInstance = () => {
    let found = false;
    const matrix = new Matrix4();
    world.scene.traverse((object) => {
      if (!(object instanceof InstancedMesh) || object.geometry !== geometry) return;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        if (matrix.elements[12] === 8 && matrix.elements[13] === -(row + .5) * 16 && matrix.elements[14] === -32)
          found = true;
      }
    });
    return found;
  };
  try {
    world.update(frame, 960, 540);
    await Promise.resolve();
    world.update(frame, 960, 540);
    expect(load.mock.calls.filter(([name]) => name === "terreno/rochoso")).toHaveLength(1);
    expect(hasInstance()).toBe(true);
    terrain.remove(0, row, -2);
    world.update(frame, 960, 540);
    expect(hasInstance()).toBe(false);
  } finally {
    world.dispose();
    geometry.dispose();
    material.dispose();
  }
});

it("minera a face tocada em terceira pessoa usando o alcance do jogador", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, { "0,9,-2": 2 });
  const frame: SurfaceFrame = {
    terrain, settlement: emptySettlement(), thirdPerson: true,
    camera: { x: 8, y: 153, z: 0, yaw: 0, pitch: 0 },
    revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
    animals: [], fruit: [], drops: [],
  };
  try {
    world.update(frame, 390, 760);
    world.camera.updateMatrixWorld();
    const screen = new Vector3(8, -152, -32).project(world.camera);
    const hit = world.pointAt(screen.x, screen.y, true);
    expect(hit).toMatchObject({ x: 0, y: 9, depth: -2, terrain: true });
    expect(Math.abs(hit!.wz! + 24)).toBeLessThan(0.65);
    expect(hit!.distance).toBeLessThan(77);
    expect(world.camera.position.distanceTo(new Vector3(hit!.wx, -hit!.wy, hit!.wz!))).toBeGreaterThan(77);
  } finally {
    world.dispose();
  }
});

it("aproxima a câmera de terceira pessoa quando há terreno atrás do jogador", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, {});
  const frame: SurfaceFrame = {
    terrain, settlement: emptySettlement(), thirdPerson: true,
    camera: { x: 8, y: 153, z: 0, yaw: 0, pitch: 0 },
    revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0,
    animals: [], fruit: [], drops: [],
  };
  try {
    world.update(frame, 960, 540);
    expect(world.showPilot).toBe(true);
    expect(world.camera.position.z).toBeGreaterThan(30);
    terrain.changes["0,8,1"] = 2;
    terrain.changes["0,9,1"] = 2;
    world.update(frame, 960, 540);
    expect(world.camera.position.z).toBeLessThan(8);
    frame.thirdPerson = false;
    world.update(frame, 960, 540);
    expect(world.camera.position.toArray()).toEqual([8, -145.5, 0]);
    expect(world.showPilot).toBe(false);
  } finally {
    world.dispose();
  }
});

it("escolhe uma saída lateral fora do casco da nave pousada", () => {
  const terrain = new Terrain(planet, {});
  const settlement = emptySettlement();
  const hull = fallbackLandedHull;
  const point = landingSideExit(terrain, settlement, 0, hull);
  expect(point).toBeDefined();
  expect(Math.abs(point!.x)).toBeLessThan(32);
  expect(Math.abs(point!.z)).toBeGreaterThan(hull.maxZ);
  expect(landedHullOverlap(hull, point!.x, point!.y - terrain.height(0) * 16, point!.z)).toBe(0);
  expect(landedHullOverlap(hull, 0, -12, 0)).toBeGreaterThan(0);
});

it("deixa espaço vazio dentro dos limites externos da nave transitável", () => {
  const hull = { ...fallbackLandedHull, intersectsMesh: (x: number) => x < 20 };
  expect(landedHullOverlap(hull, 70, -12, 0)).toBe(0);
  expect(landedHullOverlap(hull, 0, -12, 0)).toBe(1);
});

it("exige pulo para subir um bloco durante a caminhada", () => {
  const solid = (x: number, y: number) => y >= (x >= 1 ? 9 : 10);
  let actor = { x: 8, y: 148, z: 0, vy: 0, grounded: true };
  for (let i = 0; i < 30; i++)
    actor = stepSurfaceDepth(actor, 1, 0, false, 1, .016, solid);
  expect(actor.x).toBeLessThan(16);
  expect(actor.y).toBeGreaterThanOrEqual(147);
  for (let i = 0; i < 50; i++)
    actor = stepSurfaceDepth(actor, 1, 0, i === 0, 1, .016, solid);
  expect(actor.x).toBeGreaterThan(32);
  expect(actor.y).toBeLessThan(140);
});

it("desaparece gradualmente só o bloco minerado e restaura ao cancelar sem alterar o terreno", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, { "0,9,-2": 2 });
  const frame: SurfaceFrame = {
    terrain, settlement: emptySettlement(), camera: { x: 8, y: 153, z: 16, yaw: 0, pitch: 0 },
    revision: 0, light: 1, elapsed: 0, sunPhase: 0, facing: 1, stride: 0, animals: [], fruit: [], drops: [],
  };
  try {
    world.update({ ...frame, mining: { x: 0, y: 9, depth: -2, progress: .5 } }, 960, 540);
    const fading = world.scene.getObjectByName("mining-block-fade") as Mesh;
    expect(fading).toBeDefined();
    expect((fading.material as MeshStandardMaterial).opacity).toBe(.5);
    expect(terrain.getAt(0,9,-2)).toBe(2);
    world.update({ ...frame, mining: { x: 0, y: 9, depth: -2, progress: .8 } }, 960, 540);
    expect(world.scene.getObjectByName("mining-block-fade")).toBe(fading);
    expect((fading.material as MeshStandardMaterial).opacity).toBeCloseTo(.2);
    world.update(frame, 960, 540);
    expect(world.scene.getObjectByName("mining-block-fade")).toBeUndefined();
    expect(terrain.getAt(0,9,-2)).toBe(2);
  } finally { world.dispose(); }
});

it("balança a árvore durante o corte e anima a queda antes de removê-la", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, {});
  const tree = treeAt(planet, terrain, 0)!;
  const settlement = emptySettlement();
  const frame: SurfaceFrame = {
    terrain, settlement, revision: 0, light: 1, elapsed: 0.2,
    sunPhase: 0, facing: 1, stride: 0, animals: [], fruit: [], drops: [],
    camera: { x: tree.x * 16 + 8, y: tree.ground * 16 - 15, z: 27, yaw: 0, pitch: 0 },
    chopping: { id: tree.id, progress: .5, saber: false },
  };
  try {
    world.update(frame, 960, 540);
    const group = world.scene.children.find(node => node.userData.flora?.treeId === tree.id)!;
    expect(group.rotation.z).not.toBe(0);
    expect(group.getObjectByName("tree-cut-chips")?.visible).toBe(true);
    world.update({ ...frame, chopping: undefined }, 960, 540);
    expect(group.rotation.z).toBe(0);
    expect(group.getObjectByName("tree-cut-chips")?.visible).toBe(false);
    settlement.cutTrees.push(tree.id);
    world.update({ ...frame, elapsed: 1, chopping: undefined }, 960, 540);
    expect(group.parent).toBe(world.scene);
    expect(world.pointAt(0, 0, true)?.treeId).not.toBe(tree.id);
    world.update({ ...frame, elapsed: 1.7, chopping: undefined }, 960, 540);
    expect(Math.abs(group.rotation.x) + Math.abs(group.rotation.z)).toBeGreaterThan(.1);
    world.update({ ...frame, elapsed: 3, chopping: undefined }, 960, 540);
    expect(group.parent).toBe(null);
  } finally { world.dispose(); }
});

it("exibe os troncos coletáveis somente após a queda e remove o visual após recolher", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const world = new SurfaceWorld3D();
  const terrain = new Terrain(planet, {});
  const tree = treeAt(planet, terrain, 0)!;
  const settlement = emptySettlement();
  settlement.woodDrops = { [tree.id]: {
    x: tree.x * 16 + 8, y: tree.ground * 16 - 8, z: 5,
    quantity: 8, availableAt: 1.2,
  } };
  const frame: SurfaceFrame = {
    terrain, settlement, revision: 0, light: 1, elapsed: 0,
    sunPhase: 0, facing: 1, stride: 0, animals: [], fruit: [], drops: [],
    camera: { x: tree.x * 16 + 8, y: tree.ground * 16 - 15, z: 27, yaw: 0, pitch: 0 },
  };
  const logs = () => world.scene.children.filter(group => group.userData.woodDrop);
  try {
    world.update({ ...frame, gameTime: 1 }, 960, 540);
    expect(logs()).toHaveLength(0);
    world.update({ ...frame, gameTime: 1.2 }, 960, 540);
    expect(logs()).toHaveLength(1);
    delete settlement.woodDrops[tree.id];
    world.update({ ...frame, gameTime: 2 }, 960, 540);
    expect(logs()).toHaveLength(0);
  } finally { world.dispose(); }
});
