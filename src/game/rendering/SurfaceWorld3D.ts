import { facilityDefinitions, isFacility, type FacilityKind } from "../../construction/facilityTypes";
import { isBaseLight } from "../../construction/lighting";
import { surfaceLayer, solidSurfaceVoxel, surfaceWallZ, surfaceWallThickness, surfaceWallPenetration } from "../physics/surfaceDepth";
import * as T from "three";
import { cabinetWidths, isCabinet, isDoor, pieceWidth, keyAt } from "../../construction/pieces";
import type { Animal, Fruit } from "../../survival/wildlife";
import { hash } from "../procedural/random";
import { TILE, type Terrain } from "../procedural/terrain";
import { spatialTreesNear, treesInRange } from "../procedural/trees";
import { weatherCeiling, type Precipitation } from "../procedural/weather";
import { biomes, type BuildItem, type Settlement } from "../types";

const terrainKits = [
  "rochoso", "desertico", "gelado", "florestal", "vulcanico", "oceanico",
] as const;
const surfaceTileOffset = 16;

const equipmentModels = {
  ...Object.fromEntries(Object.entries(facilityDefinitions).map(([id, spec]) => [id, { file: spec.file, width: 29, height: id === "observatory" ? 30 : id === "geoProbe" ? 24 : 23, depth: 14, center: -8 }])) as Record<FacilityKind, { file: string; width: number; height: number; depth: number; center: number }>,
  workbench: { file: "bancada-planetaria", width: 30, height: 16, depth: 12, center: -8 },
  planetaryOxygenGenerator: { file: "gerador-oxigenio", width: 15, height: 23, depth: 12, center: -3 },
  campfire: { file: "fogueira", width: 12, height: 10, depth: 12, center: -3 },
  stickLadder: { file: "escada-vertical", width: 12, height: 16, depth: 3, center: -2 },
  woodStairs: { file: "escada-madeira", width: 16, height: 16, depth: 12, center: -6 },
  woodWall: { file: "parede-madeira", width: 16, height: 16, depth: surfaceWallThickness, center: surfaceWallZ - 8 },
  woodBlock: { file: "bloco-madeira", width: 16, height: 16, depth: 16, center: -8 },
  battery: { file: "bateria", width: 13, height: 12, depth: 9, center: -5 },
  oxygenGenerator: { file: "gerador-oxigenio", width: 13, height: 12, depth: 9, center: -5 },
  solarPanel: { file: "placa-solar", width: 15, height: 11, depth: 10, center: -6 },
  cabinet: { file: "bau", width: 14, height: 14, depth: 11, center: -5 },
  cabinetDouble: { file: "bau-duplo", width: 30, height: 14, depth: 11, center: -5 },
  cabinetTriple: { file: "bau-triplo", width: 46, height: 14, depth: 11, center: -5 },
} satisfies Partial<Record<BuildItem, {
  file: string; width: number; height: number; depth: number; center: number;
}>>;

type Point = { x: number; y: number };
export interface SurfaceTarget extends Point {
  wallFace?: number;
  wx: number;
  wy: number;
  depth: number;
  terrain?: boolean;
  treeId?: string;
  fruitId?: string;
  distance?: number;
}
export interface SurfaceFrame {
  terrain: Terrain;
  settlement: Settlement;
  camera: Point & { z: number; yaw: number; pitch: number };
  thirdPerson?: boolean;
  terrainRadius?: number;
  revision: number;
  light: number;
  elapsed: number;
  gameTime?: number;
  sunPhase: number;
  facing: number;
  stride: number;
  animals: readonly Animal[];
  fruit: readonly Fruit[];
  drops: readonly (Point & { z?: number })[];
  ruin?: Point;
  representative?: Point;
  storm?: { kind: Precipitation; intensity: number };
  wallPlacementFace?: number;
  cursor?: Point & { valid: boolean; depth?: number; kind?: BuildItem; rotation?: number; facing?: 1 | -1 };
  chopping?: { id: string; progress: number; saber: boolean };
  mining?: { x: number; y: number; depth: number; progress: number };
  beam?: { x: number; y: number; tx: number; ty: number; depth?: number };
}

const terrainRadius = 13;
export class SurfaceWorld3D {
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(68, 1, 0.22, 380);
  private readonly cameraEye = new T.Vector3();
  private readonly cameraOffset = new T.Vector3();
  private readonly cameraTarget = new T.Vector3();
  private readonly cameraProbe = new T.Vector3();
  showPilot = false;
  private readonly colors = new Map<number, T.MeshStandardMaterial>();
  private readonly meshes = new Map<string, T.Group>();
  private readonly fallingTrees = new Map<string, { start: number; dx: number; dz: number }>();
  private readonly ground = new T.Group();
  private readonly box = new T.BoxGeometry();
  private readonly gem = new T.DodecahedronGeometry(0.64);
  private readonly cone = new T.ConeGeometry(0.64, 1, 7);
  private readonly cylinder = new T.CylinderGeometry(0.4, 0.52, 1, 8);
  private readonly groundMaps = new Map<number, T.Texture>();
  private readonly groundMaterials = new Map<number, T.MeshStandardMaterial>();
  private readonly sun = new T.DirectionalLight(0xffe2ae, 2.1);
  private readonly ambient = new T.HemisphereLight(0xe1f0ff, 0x5d6073, 1.35);
  private readonly backdrop = new T.Color();
  private readonly mountains = new T.Group();
  private readonly star = new T.Mesh(
    new T.SphereGeometry(18, 24, 16),
    new T.MeshBasicMaterial({ color: 0xffe7b1, fog: false }),
  );
  private readonly dayColor = new T.Color();
  private readonly cursor = new T.Mesh(
    this.box,
    new T.MeshBasicMaterial({ wireframe: true }),
  );
  private readonly beam = new T.Line(
    new T.BufferGeometry().setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(6), 3),
    ),
    new T.LineBasicMaterial({ color: 0x98f1d6 }),
  );
  private readonly weather = new T.Points(
    new T.BufferGeometry().setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(256 * 3), 3),
    ),
    new T.PointsMaterial({ transparent: true, size: 1.65 }),
  );
  private readonly ndc = new T.Vector3();
  private readonly pointer = new T.Vector2();
  private readonly ray = new T.Raycaster();
  private readonly rayPoint = new T.Vector3();
  private readonly terrainInstances = new Map<string, { mesh: T.InstancedMesh; index: number }>();
  private miningFade?: { key: string; mesh: T.InstancedMesh; index: number; original: T.Matrix4; ghost: T.Mesh };
  private readonly miningMatrix = new T.Matrix4();
  private groundKey = "";
  private readonly terrainModels = new Map<number, Map<number, T.Mesh>>();
  private readonly requestedTerrainKits = new Set<number>();
  private readonly windowGlass = new T.MeshStandardMaterial({
    color: 0xa4e4ed, transparent: true, opacity: .18, roughness: .12,
    metalness: .15, depthWrite: false, side: T.DoubleSide,
  });
  private readonly floodGlow = new T.MeshStandardMaterial({ color: 0xffefc8, emissive: 0xffe5a1, emissiveIntensity: 2, roughness: .3 });
  private readonly emergencyGlow = new T.MeshStandardMaterial({ color: 0xbaffd5, emissive: 0x48ff97, emissiveIntensity: 2.4, roughness: .35 });
  private readonly baseSpots = Array.from({ length: 4 }, () => new T.SpotLight(0xffedce, 0, 150, .6, .45, 2));
  private readonly exitLights = Array.from({ length: 2 }, () => new T.PointLight(0x68ffac, 0, 40, 2));
  private disposed = false;
  private groundTerrain?: Terrain;
  private planetKey = "";
  private targetFrame?: SurfaceFrame;
  private bounds = { left: 0, right: 0, top: 0, bottom: 0 };

  constructor(private readonly loadModel?: (asset: string) => Promise<T.Group>) {
    for (const spot of this.baseSpots) {
      spot.castShadow = false;
      this.scene.add(spot, spot.target);
    }
    this.scene.add(...this.exitLights);
    this.sun.position.set(-100, 150, 100);
    this.scene.background = this.backdrop;
    this.scene.fog = new T.Fog(this.backdrop, 85, 198);
    this.scene.add(
      this.ambient,
      this.sun,
      this.ground,
      this.mountains,
      this.star,
      this.cursor,
      this.beam,
      this.weather,
    );
    this.beam.frustumCulled = this.weather.frustumCulled = false;
  }

  private color(value: number) {
    let material = this.colors.get(value);
    if (!material) {
      material = new T.MeshStandardMaterial({ color: value, roughness: 0.82 });
      this.colors.set(value, material);
    }
    return material;
  }

  private rock(kind: number, tile: number) {
    const key = kind * 16 + tile;
    let material = this.groundMaterials.get(key);
    if (!material) {
      const map = new T.TextureLoader().load(
        import.meta.env.BASE_URL + `surface/voxels/${kind}-${tile}.webp`,
      );
      map.colorSpace = T.SRGBColorSpace;
      this.groundMaps.set(key, map);
      material = new T.MeshStandardMaterial({ map, roughness: 0.91 });
      this.groundMaterials.set(key, material);
    }
    return material;
  }

  private part(
    root: T.Group,
    geometry: T.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const object = new T.Mesh(geometry, this.color(color));
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    root.add(object);
    return object;
  }

  private attachLifeModel(
    group: T.Group, key: string, width: number, height: number, depth: number,
  ) {
    this.attachSurfaceModel(group, "biosfera/" + key, width, height, depth);
  }

  private attachSurfaceModel(
    group: T.Group, file: string, width: number, height: number, depth: number,
    centerZ = 0, mirrorX = false,
  ) {
    void this.loadModel?.(file)
      .then((asset) => {
        if (!group.parent) return;
        const model = asset.clone();
        const bounds = new T.Box3().setFromObject(model);
        const size = bounds.getSize(new T.Vector3());
        if (!size.x || !size.y || !size.z) return;
        const center = bounds.getCenter(new T.Vector3());
        model.scale.set((mirrorX ? -width : width) / size.x, height / size.y, depth / size.z);
        model.position.set(
          -center.x * model.scale.x,
          -bounds.min.y * model.scale.y,
          centerZ - center.z * model.scale.z,
        );
        group.clear();
        group.add(model);
      })
      .catch((error: unknown) =>
        console.warn("Modelo da superfície indisponível.", file, error),
      );
  }

  private loadTerrainKit(kind: number) {
    const file = terrainKits[kind];
    if (!file || !this.loadModel || this.requestedTerrainKits.has(kind)) return;
    this.requestedTerrainKits.add(kind);
    void this.loadModel("terreno/" + file).then((asset) => {
      if (this.disposed) return;
      const models = new Map<number, T.Mesh>();
      asset.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const name = /^voxel_(\d+)_(0|1)$/.exec(object.name);
        if (name) models.set(Number(name[1]) + Number(name[2]) * surfaceTileOffset, object);
      });
      this.terrainModels.set(kind, models);
      if (this.groundTerrain?.planet.kind === kind) this.groundKey = "";
    }).catch((error: unknown) => {
      console.warn("Kit de terreno indisponível.", file, error);
    });
  }

  private updateTerrain(frame: SurfaceFrame) {
    const { terrain } = frame;
    const kind = terrain.planet.kind;
    this.loadTerrainKit(kind);
    const models = this.terrainModels.get(kind);
    const radius = frame.terrainRadius ?? terrainRadius;
    const centerX = Math.floor(frame.camera.x / (3 * TILE)) * 3;
    const centerZ = Math.floor(surfaceLayer(frame.camera.z) / 3) * 3;
    const playerRow = Math.floor(frame.camera.y / (4 * TILE)) * 4;
    const key = [
      terrain.planet.id,
      frame.revision,
      terrain.editRevision,
      centerX,
      centerZ,
      playerRow,
      radius,
    ].join(":");
    if (terrain === this.groundTerrain && key === this.groundKey) return;
    this.groundTerrain = terrain;
    this.groundKey = key;
    this.clearMiningFade();
    this.terrainInstances.clear();
    const solidTiles = new Map<number, { x: number; y: number; z: number }[]>();
    for (let x = centerX - radius; x <= centerX + radius + 2; x++)
      for (
        let z = centerZ - radius;
        z <= centerZ + radius + 2;
        z++
      ) {
        if (Math.hypot(x - centerX - 1, z - centerZ - 1) > radius + 1)
          continue;
        const top = terrain.heightAt(x, z);
        const bottom = Math.max(top + 1, playerRow + 6);
        for (let y = Math.min(top, playerRow - 4); y <= bottom; y++) {
          const tile = terrain.getAt(x, y, z);
          if (
            !tile ||
            (terrain.getAt(x, y - 1, z) &&
              terrain.getAt(x, y + 1, z) &&
              terrain.getAt(x - 1, y, z) &&
              terrain.getAt(x + 1, y, z) &&
              terrain.getAt(x, y, z - 1) &&
              terrain.getAt(x, y, z + 1))
          )
            continue;
          const type = tile >= 1 && tile <= 12 ? tile : 1;
          const surfaceType = type + surfaceTileOffset;
          const model = y === top && models?.has(surfaceType) ? surfaceType : type;
          const group = solidTiles.get(model) ?? [];
          group.push({ x, y, z });
          solidTiles.set(model, group);
        }
      }
    for (const child of [...this.ground.children]) {
      this.ground.remove(child);
      if (child instanceof T.InstancedMesh) child.dispose();
    }
    const matrix = new T.Matrix4();
    for (const [tile, positions] of solidTiles) {
      const model = models?.get(tile);
      const surface = new T.InstancedMesh(
        model?.geometry ?? this.box,
        model?.material ?? this.rock(kind, tile),
        positions.length,
      );
      positions.forEach(({ x, y, z }, index) => {
        matrix.makeScale(TILE, TILE, TILE)
          .setPosition((x + .5) * TILE, -(y + .5) * TILE, z * TILE);
        surface.setMatrixAt(index, matrix);
        this.terrainInstances.set(keyAt(x, y, z), { mesh: surface, index });
      });
      surface.instanceMatrix.needsUpdate = true;
      this.ground.add(surface);
    }
  }

  private clearMiningFade() {
    const fade = this.miningFade;
    if (!fade) return;
    fade.mesh.setMatrixAt(fade.index, fade.original);
    fade.mesh.instanceMatrix.needsUpdate = true;
    fade.ghost.removeFromParent();
    const materials = Array.isArray(fade.ghost.material) ? fade.ghost.material : [fade.ghost.material];
    for (const material of materials) material.dispose();
    this.miningFade = undefined;
  }

  private updateMiningFade(frame: SurfaceFrame) {
    const mining = frame.mining;
    if (!mining || mining.progress <= 0) { this.clearMiningFade(); return; }
    const key = keyAt(mining.x, mining.y, mining.depth);
    const instance = this.terrainInstances.get(key);
    if (!instance) { this.clearMiningFade(); return; }
    if (this.miningFade?.key !== key || this.miningFade.mesh !== instance.mesh) {
      this.clearMiningFade();
      const original = new T.Matrix4();
      instance.mesh.getMatrixAt(instance.index, original);
      const cloneMaterial = (material: T.Material) => {
        const copy = material.clone(); copy.transparent = true; copy.depthWrite = false; return copy;
      };
      const material = Array.isArray(instance.mesh.material)
        ? instance.mesh.material.map(cloneMaterial) : cloneMaterial(instance.mesh.material);
      const ghost = new T.Mesh(instance.mesh.geometry, material);
      ghost.name = "mining-block-fade";
      ghost.matrixAutoUpdate = false; ghost.matrix.copy(original);
      this.scene.add(ghost);
      this.miningFade = { key, ...instance, original, ghost };
      instance.mesh.setMatrixAt(instance.index, this.miningMatrix.makeScale(0, 0, 0));
      instance.mesh.instanceMatrix.needsUpdate = true;
    }
    const ghost = this.miningFade.ghost;
    const materials = Array.isArray(ghost.material) ? ghost.material : [ghost.material];
    for (const material of materials) material.opacity = Math.max(.04, 1 - mining.progress);
  }

  private piece(
    kind: BuildItem,
    open: boolean,
    facing: number,
    powered: boolean,
    emergencyActive = false,
  ) {
    const group = new T.Group();
    const block = (
      color: number,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => this.part(group, this.box, color, x, y, z, w, h, d);
    const wood = 0x91603e,
      trim = 0xc28a51,
      metal = 0x495e73,
      light = 0x75d9d3;
    if (isFacility(kind)) {
      block(0x293d49, 0, 8, -8, 29, 16, 14);
      block(0x68cfe5, 0, 14, 0, 18, 3, 1);
    } else if (kind === "woodWall" || kind === "stoneWall" || kind === "metalWall") {
      const color =
        kind === "woodWall"
          ? 0x634237
          : kind === "stoneWall"
            ? 0x696f7b
            : metal;
      block(color, 0, 8, surfaceWallZ - 8, 16, 16, surfaceWallThickness);
      for (const y of [4, 9, 14]) block(0x343741, 0, y, -12.4, 16, 0.42, 0.2);
    } else if (kind === "woodBlock") {
      block(wood, 0, 8, -8, 16, 16, 16);
      for (const y of [2, 7, 12]) block(trim, 0, y, 0, 15, 0.5, 0.32);
    } else if (kind === "workbench") {
      block(0x8f6445, 0, 11, -8, 30, 2, 12);
      for (const x of [-12, 12]) for (const z of [-12, -4]) block(metal, x, 5, z, 2, 10, 2);
      block(0x344855, 0, 3, -8, 26, 2, 10);
      block(0x456b5a, -4, 12.3, -7, 12, .5, 8);
      block(metal, 10, 14, -6, 6, 4, 4);
    } else if (kind === "floodlight") {
      block(0x263746, 0, 1.2, 0, 11, 2.4, 10);
      block(metal, 0, 7, 0, 2.2, 12, 2.2);
      for (const side of [-1, 1]) {
        block(0xa4b1b5, side * 5.1, 1.7, 0, 1, .6, 8.5);
        block(0xd7b865, side * 4.5, 12.5, 0, 1, 5, 3.5);
      }
      block(0x324350, 0, 16, 0, 11, 7, 5);
      const lens = block(powered ? 0xfff2c9 : 0x475a62, 0, 16, 2.65, 9, 5, .4);
      if (powered) lens.material = this.floodGlow;
      for (const x of [-3, 0, 3]) block(0x879492, x, 16, 2.94, .22, 4.5, .15);
      for (const side of [-1, 1]) for (const y of [13.4, 18.6])
        block(0xa5b4b8, side * 4.9, y, 2.7, .5, .5, .3);
      for (const y of [14, 16, 18]) block(0x182c37, 0, y, -2.6, 8, .4, .3);
    } else if (kind === "emergencyLight") {
      block(0x354a54, 0, 10, -4, 14, 8, 3);
      block(0x152e29, 0, 10, -2.4, 11.8, 5.6, .3);
      for (const x of [-6, 6]) for (const y of [7, 13]) block(0xa8b8bb, x, y, -2.3, .5, .5, .25);
      const stem = block(emergencyActive ? 0x8bffc0 : 0x375e4b, 0, 10.3, -2.1, 1.3, 3.8, .35);
      if (emergencyActive) stem.material = this.emergencyGlow;
      for (const side of [-1, 1]) {
        const arrow = block(emergencyActive ? 0x8bffc0 : 0x375e4b, side * 1.2, 8.7, -2.1, 1.2, 3.5, .35);
        arrow.rotation.z = side * -.75;
        if (emergencyActive) arrow.material = this.emergencyGlow;
      }
      block(powered ? 0x83e8c1 : 0xd5a15a, 4.5, 10, -2.1, .8, .8, .35);
    } else if (kind === "window") {
      const z = surfaceWallZ;
      for (const side of [-1, 1]) block(metal, side * 7, 8, z, 2, 16, 3);
      for (const y of [1, 15]) block(metal, 0, y, z, 12, 2, 3);
      const glass = new T.Mesh(this.box, this.windowGlass);
      glass.position.set(0, 8, z); glass.scale.set(12, 12, .35); group.add(glass);
      for (const side of [-1, 1]) {
        for (const x of [-6.8, 6.8]) for (const y of [2, 8, 14])
          block(0xb6c4ce, x, y, z + side * 1.55, .5, .5, .2);
        for (const y of [2.1, 13.9]) block(0x213a46, 0, y, z + side * 1.55, 11.8, .35, .2);
      }
    } else if (kind === "airlockDoor") {
      const z = surfaceWallZ;
      for (const side of [-1, 1]) {
        block(0x324450, side * 7, 16, z, 2, 32, 4);
        for (const face of [-1, 1]) {
          block(open ? 0x80e5af : 0xe0af62, side * 7, 18, z + face * 2.1, .7, 13, .25);
          for (const y of [3, 9, 25, 30]) block(0xa9bac4, side * 7, y, z + face * 2.2, .6, .6, .25);
        }
        const panelX = side * (open ? 10.5 : 3);
        block(0x657d8c, panelX, 16, z, 6, 28, 1.8);
        for (const face of [-1, 1]) {
          block(0x283e4c, panelX, 22, z + face, 4.4, 6, .3);
          block(0x82d7df, panelX, 22, z + face * 1.2, 3.3, 4.3, .2);
          for (const y of [7, 11, 29]) block(0x8f9faa, panelX, y, z + face, 4.5, .4, .3);
          block(0xd5ad61, panelX, 4, z + face * 1.1, 5.3, 1, .25);
        }
      }
      for (const y of [1, 31]) block(0x324450, 0, y, z, 16, 2, 4);
    } else if (kind === "woodDoor") {
      for (const side of [-1, 1]) block(trim, side * 7, 16, -2, 2, 32, 5);
      block(wood, 0, 31, -2, 16, 2, 5);
      const door = block(wood, open ? -7 : 0, 15, open ? -7 : -1, 12, 29, 2);
      if (open) door.rotation.y = Math.PI / 2;
      else block(trim, 4, 14, 0.5, 2, 2, 1.1);
    } else if (kind === "stickLadder") {
      for (const side of [-1, 1]) block(wood, side * 5, 8, -2, 1.4, 16, 2);
      for (const y of [2, 6, 10, 14]) block(trim, 0, y, -1, 10, 1.2, 2);
    } else if (kind === "woodHatch") {
      block(wood, 0, 1.1, -7, 16, 2.2, 14);
      if (open) {
        group.clear();
        block(wood, -7, 8, -7, 2, 16, 14);
      }
      block(trim, -6, 1.8, -2, 2, 1, 3);
    } else if (kind === "woodStairs") {
      for (let i = 0; i < 4; i++)
        block(wood, (i * 4 - 6) * facing, (i + 1) * 2, -6, 4, (i + 1) * 4, 12);
    } else if (isCabinet(kind)) {
      const width = cabinetWidths[kind] * 16 - 2;
      block(kind === "fridge" ? metal : wood, 0, 7, -5, width, 14, 10);
      block(trim, 0, 9.5, 0.4, width * 0.92, 0.6, 0.4);
      block(
        kind === "fridge" && !powered ? 0x4c595a : light,
        width * 0.36,
        7,
        0.5,
        1.5,
        3,
        0.6,
      );
    } else if (kind === "solarPanel") {
      block(metal, 0, 4, -6, 2, 8, 3);
      block(0x295883, 0, 9, -6, 15, 1.6, 10).rotation.x = 0.3;
      for (const x of [-4, 0, 4])
        block(light, x, 10, -6, 0.3, 0.4, 9).rotation.x = 0.3;
    } else if (kind === "campfire") {
      block(wood, 0, 1, -3, 12, 2.2, 8);
      this.part(group, this.cone, 0xff782f, 0, 5, -3, 6, 8, 6);
      this.part(group, this.cone, 0xffcf71, 1, 4, -1, 3, 5, 3);
    } else if (kind === "table" || kind === "bed") {
      const bed = kind === "bed";
      const y = bed ? 4 : 9;
      block(bed ? 0x7088b1 : wood, 0, y, -6, 15, 2.5, 11);
      for (const x of [-5.8, 5.8]) block(wood, x, y / 2, -6, 1.7, y, 9);
      if (bed) block(0xc6dadc, -4, 6, -6, 5, 2, 9);
    } else if (kind === "picture") {
      block(trim, 0, 10, -11, 13, 9, 1);
      block(0x609cb5, 0, 10, -10.4, 10, 6, 0.3);
    } else {
      block(metal, 0, 6, -5, 13, 12, 9);
      block(0x223544, 0, 8, -0.2, 9, 4, 1.2);
      block(0x6ec9d9, 2, 8, 0.6, 2, 2, 0.7);
    }
    return group;
  }

  private placeCamera(frame: SurfaceFrame) {
    const { x, y, z, yaw, pitch } = frame.camera;
    const eye = this.cameraEye.set(x, -y + 7.5, z);
    this.camera.position.copy(eye);
    this.camera.rotation.set(pitch, yaw, 0, "YXZ");
    this.showPilot = false;
    if (!frame.thirdPerson) return;

    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const behind = 55 * Math.cos(pitch);
    const offset = this.cameraOffset.set(
      sin * behind + cos * 9,
      18 - Math.sin(pitch) * 40,
      cos * behind - sin * 9,
    );
    const { terrain, settlement } = frame;
    const samples = Math.ceil(offset.length() / 1.5);
    const initialWall = surfaceWallPenetration(settlement, x, y, z);
    for (let step = 1; step <= samples; step++) {
      const probe = this.cameraProbe.copy(eye).addScaledVector(offset, step / samples);
      const depth = surfaceLayer(probe.z);
      if (solidSurfaceVoxel(terrain, settlement, Math.floor(probe.x / TILE),
          Math.floor(-probe.y / TILE), depth) ||
          surfaceWallPenetration(settlement, probe.x, -probe.y + 7.5, probe.z) > initialWall)
        break;
      this.camera.position.copy(probe);
    }
    if (this.camera.position.distanceToSquared(eye) < 10 ** 2) {
      this.camera.position.copy(eye);
      return;
    }
    this.showPilot = true;
    this.cameraTarget.set(0, 0, -62).applyEuler(this.camera.rotation).add(eye);
    this.camera.lookAt(this.cameraTarget);
  }

  update(frame: SurfaceFrame, width: number, height: number) {
    const { terrain, settlement, light, elapsed } = frame;
    const planet = terrain.planet;
    const biome = biomes[planet.kind]!;
    if (this.planetKey !== planet.id) {
      this.planetKey = planet.id;
      this.mountains.clear();
      for (let i = 0; i < 20; i++) {
        const seed = hash(planet.id + ":" + i);
        const span = 130 + (seed % 100);
        const height = 50 + ((seed >>> 6) % (planet.kind === 1 ? 62 : 138));
        this.part(
          this.mountains,
          this.cone,
          i % 2 ? biome.ground : biome.color,
          (i - 10) * 96,
          height * -0.12,
          -290 - (seed % 5) * 37,
          span,
          height,
          span,
        );
      }
    }
    this.backdrop
      .setHex(biome.sky)
      .lerp(this.dayColor.setHex(biome.daySky), light);
    (this.scene.fog as T.Fog).color.copy(this.backdrop);
    this.ambient.intensity = 0.52 + light * 1.02;
    this.sun.intensity = 0.15 + light * 1.9;
    const aspect = width / height;
    const spanY = 172;
    const spanX = Math.min(380, spanY * aspect);
    const { x, y, z, yaw } = frame.camera;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 76 : 67;
    this.placeCamera(frame);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.mountains.position.set(x, -y - 75, z);
    this.mountains.rotation.y = yaw;
    this.star.visible = light > 0.03;
    this.star.position.set(
      x + Math.sin(frame.sunPhase) * 95,
      -y + 65 + light * 65,
      z - 240,
    );
    this.bounds = {
      left: Math.floor(x / TILE) - terrainRadius,
      right: Math.ceil(x / TILE) + terrainRadius,
      top: Math.max(0, Math.floor(y / TILE) - 9),
      bottom: Math.max(1, Math.ceil(y / TILE) + 9),
    };
    this.updateTerrain(frame);
    this.updateMiningFade(frame);
    const seen = new Set<string>();
    const put = (
      key: string,
      wx: number,
      wy: number,
      z: number,
      make: () => T.Group,
    ) => {
      seen.add(key);
      let group = this.meshes.get(key);
      if (!group) {
        group = make();
        this.meshes.set(key, group);
        this.scene.add(group);
      }
      group.position.set(wx, -wy, z + 8);
      return group;
    };
    this.updateBaseLights(frame);
    const { left, right, top, bottom } = this.bounds;
    for (let x = left - 2; x < right; x++)
      for (let y = top; y < bottom; y++) {
        const key = x + "," + y;
        const wall = settlement.walls[key];
        if (wall) this.putWall(put, settlement, key, wall, x, y, 0);
      }
    for (const [key, piece] of Object.entries(settlement.pieces)) {
      const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
      if (x < left - 3 || x > right || y < top || y > bottom ||
          Math.abs(depth * TILE - z) > 224) continue;
      const size = pieceWidth(piece.kind);
      put(
        `piece:${key}:${piece.kind}:${piece.open}:${piece.facing}:${piece.powered}:${piece.rotation}:${piece.emergencyActive}`,
        (x + size / 2) * TILE, (y + 1) * TILE, depth * TILE,
        () => this.orientedPiece(piece.kind, !!piece.open, piece.facing, !!piece.powered, piece.rotation, !!piece.emergencyActive),
      ).userData.cell = { x, y, depth };
    }
    const trees = [
      ...(Math.abs(z) < 230 ? treesInRange(planet, terrain, left, right, settlement.cutTrees) : []),
      ...spatialTreesNear(terrain, x, z, settlement.cutTrees),
    ];
    for (const tree of trees) {
      const depth = tree.depth ?? 0;
      if (Math.abs(depth * TILE - z) > 215 || tree.x < left || tree.x > right) continue;
      const treeGroup = put(
        tree.id + ":" + planet.id,
        (tree.x + 0.5) * TILE,
        tree.ground * TILE,
        depth ? depth * TILE - 8 : -3,
        () => {
          const group = new T.Group();
          group.userData.flora = { treeId: tree.id, depth };
          group.userData.treeColor = tree.trunk;
          const height = tree.height * TILE;
          group.userData.trunkHeight = height * .78;
          this.part(
            group,
            this.cylinder,
            tree.trunk,
            0,
            height * 0.42,
            0,
            8,
            height * 0.84,
            8,
          );
          const conifer = tree.kind === 2 || tree.kind === 4;
          for (let i = 0; i < 5; i++) {
            const spread = tree.crown * (7 - i * 0.8);
            this.part(
              group,
              conifer ? this.cone : this.gem,
              i === 4 ? tree.accent : tree.leaves,
              conifer ? 0 : Math.sin(i * 2.4) * spread * 0.64,
              height * (0.62 + i * 0.095),
              Math.cos(i * 2.4) * 5,
              spread,
              conifer ? 26 : 17,
              spread,
            );
          }
          this.attachLifeModel(group, "planta-" + tree.kind, tree.crown * 19, height, tree.crown * 14);
          return group;
        },
      );
      const cutting = frame.chopping?.id === tree.id ? frame.chopping : undefined;
      treeGroup.rotation.set(0, 0, cutting ? Math.sin(frame.elapsed * 28) * .025 * cutting.progress : 0);
      this.treeChips(treeGroup, cutting ? cutting.progress * 3 : undefined);
    }
    for (const [id, drop] of Object.entries(settlement.woodDrops ?? {})) {
      if ((frame.gameTime ?? 0) < drop.availableAt || Math.abs(drop.x - x) > 215 ||
          Math.abs(drop.z - z) > 215) continue;
      const logs = put("woodDrop:" + planet.id + ":" + id, drop.x, drop.y + 7, drop.z - 8, () => {
        const group = new T.Group();
        for (let i = 0; i < Math.min(3, drop.quantity); i++) {
          const log = this.part(group, this.cylinder, 0x81502c,
            0, 2 + i * 2, (i % 2) * 3 - 1.5, 5, 13, 5);
          log.rotation.z = Math.PI / 2;
          const end = this.part(group, this.cylinder, 0xd5aa6c,
            6.6, 2 + i * 2, (i % 2) * 3 - 1.5, 4.4, .6, 4.4);
          end.rotation.z = Math.PI / 2;
        }
        group.userData.woodDrop = id;
        return group;
      });
      logs.position.y += Math.sin(frame.elapsed * 3) * .7;
    }
    const near = (point: Point) =>
      Math.abs(z) < 220 && point.x >= left * TILE && point.x <= right * TILE;
    for (const fruit of frame.fruit) {
      const depth = fruit.depth ?? 0;
      if (Math.abs(depth * TILE - z) > 215 || fruit.x < left * TILE || fruit.x > right * TILE) continue;
      put("fruit:" + fruit.id + ":" + planet.id, fruit.x, fruit.y, depth ? depth * TILE - 8 : 1, () => {
        const group = new T.Group();
        for (const i of [-1, 0, 1])
          this.part(
            group,
            this.gem,
            fruit.color,
            i * 4,
            1 - Math.abs(i) * 1.6,
            0,
            5,
            5,
            5,
          );
        group.userData.flora = { fruitId: fruit.id, depth };
        this.attachLifeModel(group, "fruta-" + planet.kind, 17, 10, 10);
        return group;
      });
    }
    for (const animal of frame.animals.filter(near)) {
      const model = put(
        animal.id + ":" + planet.id,
        animal.x,
        animal.y + 10,
        1,
        () => {
          const group = new T.Group();
          const size = animal.hostile ? 1.16 : 1;
          this.part(group, this.gem, animal.hide, 0, 8, 0, 14 * size, 9, 8);
          this.part(group, this.gem, animal.crest, 8 * size, 10, 0, 6, 6, 6);
          for (const side of [-1, 1])
            for (const front of [-1, 1])
              this.part(
                group,
                this.cylinder,
                animal.hide,
                front * 5,
                3,
                side * 3,
                2.5,
                6,
                2.5,
              );
          if (animal.kind === 0 || animal.kind === 4)
            this.part(
              group,
              this.cone,
              animal.hide,
              -11,
              7,
              0,
              5,
              10,
              5,
            ).rotation.z = Math.PI / 2;
          if (animal.hostile || animal.kind === 2) {
            for (const side of [-1, 1])
              this.part(
                group,
                this.cone,
                animal.crest,
                8,
                14,
                side * 2.4,
                2.4,
                6,
                2.4,
              ).rotation.z = -0.28;
          }
          if (animal.kind === 3 || animal.kind === 5)
            this.part(group, this.gem, animal.crest, -2, 12, 0, 9, 5.5, 7.6);
          const type = animal.hostile ? "hostil" : "pacifico";
          this.attachLifeModel(group, type + "-" + animal.kind,
            animal.hostile ? 30 : 25, animal.hostile ? 18 : 16, 12);
          return group;
        },
      );
      model.rotation.y = animal.facing < 0 ? Math.PI : 0;
      model.position.y += animal.grounded
        ? Math.abs(Math.sin(elapsed * 10 + animal.home))
        : 0;
    }
    frame.drops
      .filter(
        (drop) =>
          Math.abs((drop.z ?? 0) - z) < 224 &&
          drop.x >= left * TILE &&
          drop.x <= right * TILE,
      )
      .forEach((drop) =>
        put(
          "drop:" + drop.x + ":" + drop.y + ":" + (drop.z ?? 0),
          drop.x,
          drop.y,
          (drop.z ?? 0) - 8,
          () => {
            const group = new T.Group();
            group.userData.dropDepth = surfaceLayer(drop.z ?? 0);
            this.part(group, this.box, 0xa36c3f, 0, -7, 0, 12, 11, 6);
            this.part(group, this.box, 0xffc87b, 0, -7, 3, 3, 4, 1);
            return group;
          },
        ),
      );
    if (frame.ruin && near(frame.ruin))
      put("ruin:" + planet.id, frame.ruin.x, frame.ruin.y + 9, -4, () => {
        const group = new T.Group();
        for (const x of [-12, 12])
          this.part(group, this.box, 0x596768, x, 13, 0, 6, 26, 9).rotation.z =
            -x / 110;
        this.part(group, this.box, 0x6a7e7c, 0, 26, 0, 29, 5, 9);
        this.part(group, this.gem, 0x77cac1, 0, 26, 5, 6, 5, 4);
        return group;
      });
    for (const [key, kind] of Object.entries({ ...settlement.depthBlocks, ...settlement.depthWalls })) {
      const [tx = 0, ty = 0, depth = 0] = key.split(",").map(Number);
      if (tx < left || tx > right || ty < top || ty > bottom ||
          Math.abs(depth * TILE - z) > 224) continue;
      const wall = settlement.depthWalls?.[key];
      if (wall) this.putWall(put, settlement, key, wall, tx, ty, depth);
      else put("depthBlock:" + key + ":" + kind, (tx + 0.5) * TILE,
        (ty + 1) * TILE, depth * TILE, () => this.orientedPiece("woodBlock", false, 1, false));
    }
    for (const [key, group] of this.meshes)
      if (!seen.has(key)) {
        const treeId = group.userData.flora?.treeId as string | undefined;
        const cut = treeId && key === treeId + ":" + planet.id && settlement.cutTrees.includes(treeId);
        if (cut) {
          let fall = this.fallingTrees.get(key);
          if (!fall) {
            const dx = group.position.x - x, dz = group.position.z - z;
            const distance = Math.hypot(dx, dz) || 1;
            fall = { start: frame.elapsed, dx: dx === 0 && dz === 0 ? 1 : dx / distance, dz: dz / distance };
            this.fallingTrees.set(key, fall);
            group.userData.flora = { ...group.userData.flora, falling: true };
          }
          const age = Math.max(0, frame.elapsed - fall.start);
          const angle = Math.min(1, age / 1.1) ** 2 * Math.PI * .49;
          group.rotation.set(angle * fall.dz, 0, -angle * fall.dx);
          group.scale.setScalar(age <= 1.2 ? 1 : Math.max(0, 1 - (age - 1.2) / .6));
          this.treeChips(group, age + 3);
          if (age < 1.8) continue;
        }
        group.removeFromParent();
        this.meshes.delete(key);
        this.fallingTrees.delete(key);
      }
    this.cursor.visible = !!frame.cursor;
    if (frame.cursor) {
      this.cursor.position.set(
        (frame.cursor.x + 0.5) * TILE,
        -(frame.cursor.y + 0.5) * TILE,
        (frame.cursor.depth ?? 0) * TILE,
      );
      const { kind, rotation = 0 } = frame.cursor;
      const panel = isDoor(kind) || kind === "window" || kind === "woodWall" || kind === "stoneWall" || kind === "metalWall";
      const angle = rotation * Math.PI / 2;
      this.cursor.rotation.y = angle;
      this.cursor.scale.set(
        kind ? pieceWidth(kind) * TILE : TILE + 0.3,
        isDoor(kind) || (kind && isFacility(kind)) ? TILE * 2 : TILE + 0.3,
        panel ? 4 : TILE + 0.3,
      );
      if (kind) this.cursor.position.x += (pieceWidth(kind) - 1) * TILE / 2;
      if (isDoor(kind) || (kind && isFacility(kind))) this.cursor.position.y += TILE / 2;
      if (panel) {
        this.cursor.position.x += Math.sin(angle) * surfaceWallZ;
        this.cursor.position.z += Math.cos(angle) * surfaceWallZ;
      }
      this.cursor.material.color.setHex(
        frame.cursor.valid ? 0x8ff1dd : 0xff816f,
      );
    }
    this.beam.visible = !!frame.beam;
    if (frame.beam) {
      const position = this.beam.geometry.getAttribute("position");
      position.setXYZ(0, frame.beam.x, -frame.beam.y, z);
      position.setXYZ(
        1,
        frame.beam.tx,
        -frame.beam.ty,
        (frame.beam.depth ?? 0) * TILE,
      );
      position.needsUpdate = true;
    }
    this.weather.visible = !!frame.storm;
    if (frame.storm) {
      const { kind, intensity } = frame.storm;
      const attr = this.weather.geometry.getAttribute("position");
      const ceilings = new Map<number, number>();
      for (let i = 0; i < attr.count; i++) {
        const seed = hash(planet.id + ":storm:" + i);
        const px = x - spanX / 2 + ((seed % 997) / 997) * spanX;
        const py =
          y -
          spanY / 2 +
          ((((seed % 409) + elapsed * (kind === "snow" ? 27 : 172)) % 409) /
            409) *
            spanY;
        const column = Math.floor(px / TILE);
        const rainZ = z - 60 + (seed % 120);
        const depth = surfaceLayer(rainZ);
        const key = (column - left) * 32 + depth - surfaceLayer(z);
        let ceiling = ceilings.get(key);
        if (ceiling === undefined) {
          ceiling = weatherCeiling(terrain, settlement, column, 64, depth);
          ceilings.set(key, ceiling);
        }
        attr.setXYZ(i, px, py < ceiling ? -py : -5000, rainZ);
      }
      attr.needsUpdate = true;
      this.weather.material.color.setHex(
        kind === "acid" ? 0x9cff72 : kind === "snow" ? 0xf3faff : 0x81c6e4,
      );
      this.weather.material.opacity = intensity * 0.76;
    }
    this.targetFrame = frame;
  }

  private treeChips(tree: T.Group, phase?: number) {
    let chips = tree.getObjectByName("tree-cut-chips") as T.Group | undefined;
    if (!chips && phase !== undefined) {
      chips = new T.Group(); chips.name = "tree-cut-chips";
      for (let i = 0; i < 10; i++) {
        this.part(chips, this.box, tree.userData.treeColor ?? 0x98704a,
          0, 0, 0, 1.4, .5, .7);
      }
      tree.add(chips);
    }
    if (!chips) return;
    let scar = tree.getObjectByName("tree-cut-scar") as T.Mesh | undefined;
    if (!scar) {
      scar = this.part(tree, this.box, 0x382318, 0, 8, 3.8, 8, 1.3, 1);
      scar.name = "tree-cut-scar";
    }
    scar.visible = phase !== undefined;
    scar.scale.x = 8 * Math.min(1, (phase ?? 0) / 3);
    chips.visible = phase !== undefined;
    if (phase === undefined) return;
    chips.children.forEach((chip, i) => {
      const life = (phase * 3 + i / 10) % 1;
      const angle = i * 2.4;
      chip.position.set(Math.cos(angle) * life * 13, 8 + life * 9 - life * life * 17,
        Math.sin(angle) * life * 13);
      chip.rotation.set(life * 6, angle, life * 4);
      chip.scale.setScalar(1 - life * .7);
    });
  }

  private updateBaseLights(frame: SurfaceFrame) {
    const lights = Object.entries(frame.settlement.pieces)
      .filter(([, piece]) => isBaseLight(piece.kind))
      .map(([key, piece]) => {
        const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
        const world = new T.Vector3((x + .5) * TILE, -(y + 1) * TILE + 16, depth * TILE);
        const distance = world.distanceTo(new T.Vector3(frame.camera.x, -frame.camera.y, frame.camera.z));
        return { key, piece, world, distance };
      }).filter(light => light.distance <= 160)
      .sort((a,b) => a.distance - b.distance || a.key.localeCompare(b.key));
    const floods = lights.filter(light => light.piece.kind === "floodlight" && light.piece.powered);
    this.baseSpots.forEach((spot, index) => {
      const source = floods[index];
      spot.intensity = source ? 18000 : 0;
      if (!source) return;
      const angle = (source.piece.rotation ?? 0) * Math.PI / 2;
      const direction = new T.Vector3(Math.sin(angle), -.32, Math.cos(angle)).normalize();
      spot.position.copy(source.world).addScaledVector(direction, 3);
      spot.target.position.copy(spot.position).addScaledVector(direction, 100);
    });
    const exits = lights.filter(light => light.piece.kind === "emergencyLight" && light.piece.emergencyActive);
    this.exitLights.forEach((light, index) => {
      const source = exits[index];
      light.intensity = source ? 450 : 0;
      if (source) light.position.copy(source.world).add(new T.Vector3(0, -5, 0));
    });
  }

  project(x: number, y: number, z: number, width: number, height: number) {
    const point = this.ndc.set(x, -y, z).project(this.camera);
    return {
      x: Math.round(((point.x + 1) * width) / 2),
      y: Math.round(((1 - point.y) * height) / 2),
    };
  }

  private orientedPiece(kind: BuildItem, open: boolean, facing: 1 | -1, powered: boolean, rotation?: number, emergencyActive = false) {
    const piece = this.piece(kind, open, facing, powered, emergencyActive);
    if (kind === "window" || kind === "airlockDoor" || isBaseLight(kind)) {
      const aligned = new T.Group();
      piece.position.z = -8;
      piece.rotation.y = (rotation ?? 0) * Math.PI / 2;
      aligned.add(piece);
      return aligned;
    }
    const model = kind === "woodDoor"
      ? { file: open ? "porta-aberta" : "porta-fechada", width: 16, height: 32,
          depth: open ? 15 : 5, center: open ? -7 : -2 }
      : equipmentModels[kind as keyof typeof equipmentModels];
    if (model) this.attachSurfaceModel(
      piece, "equipamentos-base/" + model.file, model.width, model.height, model.depth, model.center,
      kind === "woodStairs" && facing === -1,
    );
    if (rotation === undefined) return piece;
    const group = new T.Group();
    const pivot = new T.Group();
    pivot.position.z = -8;
    pivot.rotation.y = rotation * Math.PI / 2;
    piece.position.z = kind === "woodDoor" ? -4 : 8;
    pivot.add(piece);
    group.add(pivot);
    return group;
  }

  private putWall(
    put: (key: string, x: number, y: number, z: number, make: () => T.Group) => T.Group,
    settlement: Settlement, key: string, wall: Settlement["walls"][string],
    x: number, y: number, depth: number,
  ) {
    const draw = (material: typeof wall, rotation?: number) => put(
      `wall:${key}:${material}:${rotation}`, (x + 0.5) * TILE, (y + 1) * TILE, depth * TILE,
      () => this.orientedPiece(material === true ? "woodWall" : material, false, 1, false, rotation),
    ).userData.cell = { x, y, depth, wall: true, rotation };
    draw(wall, settlement.wallRotations?.[key]);
    for (const [face, material] of Object.entries(settlement.cornerWalls?.[key] ?? {}))
      draw(material, Number(face));
  }

  pointAt(nx: number, ny: number, hitSolid: boolean, pickPreview = false): SurfaceTarget | undefined {
    const frame = this.targetFrame;
    if (!frame) return;
    this.ray.setFromCamera(this.pointer.set(nx, ny), this.camera);
    this.ray.far = 112 + this.camera.position.distanceTo(this.cameraEye);
    this.scene.updateMatrixWorld();
    const objects = this.ray.intersectObjects(
          [...this.meshes]
            .filter(([id, group]) => !id.startsWith("woodDrop:") && !group.userData.flora?.falling)
            .filter(([id]) => hitSolid ? !id.startsWith("depthBlock:") : id.startsWith("wall:"))
            .map(([, group]) => group),
          true,
        );
    let picked: Pick<T.Intersection, "point" | "distance" | "object"> | undefined = objects[0];
    if (hitSolid) {
      const trunk = new T.Box3();
      for (const group of this.meshes.values()) {
        const height = group.userData.trunkHeight as number | undefined;
        if (!height || group.userData.flora?.falling) continue;
        const { x, y, z } = group.position;
        trunk.min.set(x - 4.7, y, z - 4.3);
        trunk.max.set(x + 4.7, y + height, z + 4.3);
        const hit = this.ray.ray.intersectBox(trunk, this.rayPoint);
        if (!hit) continue;
        const distance = this.ray.ray.origin.distanceTo(hit);
        if (distance > (picked?.distance ?? this.ray.far)) continue;
        picked = { point: hit.clone(), distance, object: group };
      }
    }
    const preview = !hitSolid && pickPreview && frame.cursor?.valid && this.cursor.visible
      ? this.ray.intersectObject(this.cursor, false)[0]
      : undefined;
    let lastAir: SurfaceTarget | undefined;
    for (let distance = 0.5; distance <= this.ray.far; distance += 0.65) {
      const position = this.ray.ray.at(distance, this.rayPoint);
      const wx = position.x,
        wy = -position.y;
      const x = Math.floor(wx / TILE),
        y = Math.floor(wy / TILE),
        depth = surfaceLayer(position.z);
      if (preview && distance >= preview.distance && preview.distance <= (picked?.distance ?? Infinity)) {
        const { x, y, depth = 0 } = frame.cursor!;
        return { x, y, depth, wx: preview.point.x, wy: -preview.point.y };
      }
      if (picked && distance >= picked.distance) {
        let node: T.Object3D | null = picked.object;
        while (node?.parent && node.parent !== this.scene) node = node.parent;
        const target = node?.userData;
        if (!hitSolid && target?.cell?.wall) {
          const { x, y, depth, rotation = 0 } = target.cell;
          const face = frame.wallPlacementFace;
          if (face !== undefined && face !== rotation &&
              !frame.settlement.cornerWalls?.[keyAt(x, y, depth)]?.[face] &&
              (frame.settlement.wallRotations?.[keyAt(x, y, depth)] ?? 0) !== face) {
            return { x, y, depth, wx: picked.point.x, wy: -picked.point.y };
          }
          const sideways = rotation % 2 !== 0;
          const horizontal = sideways
            ? picked.point.z / TILE - depth
            : picked.point.x / TILE - x - 0.5;
          const vertical = -picked.point.y / TILE - y - 0.5;
          const alongWall = Math.abs(horizontal) > Math.abs(vertical);
          const shift = alongWall ? Math.sign(horizontal) : 0;
          const nextX = x + (sideways ? 0 : shift);
          const nextDepth = depth + (sideways ? shift : 0);
          const nextY = y + (alongWall ? 0 : Math.sign(vertical) || -1);
          return { x: nextX, y: nextY, depth: nextDepth, wx: (nextX + 0.5) * TILE, wy: (nextY + 0.5) * TILE };
        }
        return {
          wx: picked.point.x,
          wy: -picked.point.y,
          x: target?.cell?.x ?? Math.floor(picked.point.x / TILE),
          y: target?.cell?.y ?? Math.floor(-picked.point.y / TILE),
          depth: target?.cell?.depth ?? target?.dropDepth ?? 0,
          ...(target?.cell?.wall ? { wallFace: target.cell.rotation ?? 0 } : {}),
          ...(target?.flora?.falling ? {} : target?.flora),
        };
      }
      const target = { wx, wy, x, y, depth };
      if (solidSurfaceVoxel(frame.terrain, frame.settlement, x, y, depth))
        return hitSolid
          ? { ...target, terrain: frame.terrain.getAt(x, y, depth) !== 0, distance }
          : lastAir;
      lastAir = target;
    }
  }

  dispose() {
    this.disposed = true;
    this.fallingTrees.clear();
    this.clearMiningFade();
    this.terrainInstances.clear();
    this.windowGlass.dispose();
    this.floodGlow.dispose(); this.emergencyGlow.dispose();
    for (const light of [...this.baseSpots, ...this.exitLights]) light.dispose();
    this.terrainModels.clear();
    for (const child of this.ground.children)
      if (child instanceof T.InstancedMesh) child.dispose();
    for (const material of [
      ...this.colors.values(),
      ...this.groundMaterials.values(),
    ])
      material.dispose();
    for (const map of this.groundMaps.values()) map.dispose();
    for (const geometry of [
      this.box,
      this.gem,
      this.cone,
      this.cylinder,
      this.beam.geometry,
      this.weather.geometry,
    ])
      geometry.dispose();
    this.star.geometry.dispose();
    this.star.material.dispose();
    this.cursor.material.dispose();
    this.beam.material.dispose();
    this.weather.material.dispose();
  }
}
