import * as T from "three";
import { cabinetWidths, isCabinet } from "../../construction/pieces";
import type { Animal, Fruit } from "../../survival/wildlife";
import { hash } from "../procedural/random";
import { TILE, type Terrain } from "../procedural/terrain";
import { treesInRange } from "../procedural/trees";
import { weatherCeiling, type Precipitation } from "../procedural/weather";
import { biomes, type BuildItem, type Settlement } from "../types";

type Point = { x: number; y: number };
export interface SurfaceFrame {
  terrain: Terrain;
  settlement: Settlement;
  camera: Point;
  light: number;
  elapsed: number;
  sunPhase: number;
  facing: number;
  stride: number;
  animals: readonly Animal[];
  fruit: readonly Fruit[];
  drops: readonly Point[];
  ruin?: Point;
  representative?: Point;
  storm?: { kind: Precipitation; intensity: number };
  cursor?: Point & { valid: boolean };
  beam?: { x: number; y: number; tx: number; ty: number };
}

const groundDepth = 18;
const ores = [
  0, 0, 0xadcad5, 0xe1905a, 0xa998e1, 0x62798e, 0xffd07b, 0x9cf5dd, 0x94d5f9,
  0xacdd87, 0xa37662, 0xe1bf61, 0x9aa9bf,
];

export class SurfaceWorld3D {
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 1800);
  private readonly colors = new Map<number, T.MeshStandardMaterial>();
  private readonly meshes = new Map<string, T.Group>();
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
  private readonly interactionPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  private groundKey = "";
  private planetKey = "";
  private targetFrame?: SurfaceFrame;
  private bounds = { left: 0, right: 0, top: 0, bottom: 0 };

  constructor() {
    this.sun.position.set(-100, 150, 100);
    this.scene.background = this.backdrop;
    this.scene.fog = new T.Fog(this.backdrop, 400, 1100);
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

  private rock(kind: number) {
    let material = this.groundMaterials.get(kind);
    if (!material) {
      const map = new T.TextureLoader().load(
        import.meta.env.BASE_URL + "surface/ground-" + kind + ".webp",
      );
      map.colorSpace = T.SRGBColorSpace;
      this.groundMaps.set(kind, map);
      material = new T.MeshStandardMaterial({ map, roughness: 0.91 });
      this.groundMaterials.set(kind, material);
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

  private updateTerrain(frame: SurfaceFrame) {
    const { terrain } = frame;
    const { left, right, top, bottom } = this.bounds;
    const cellCount = (right - left) * (bottom - top);
    const cells = new Uint8Array(cellCount);
    let signature = 2166136261;
    let index = 0;
    for (let x = left; x < right; x++)
      for (let y = top; y < bottom; y++) {
        const tile = terrain.get(x, y);
        cells[index++] = tile;
        signature = Math.imul(signature ^ tile, 16777619);
      }
    const key = [terrain.planet.id, left, right, top, bottom, signature].join(
      ":",
    );
    if (key === this.groundKey) return;
    this.groundKey = key;
    for (const child of [...this.ground.children]) {
      this.ground.remove(child);
      if (child instanceof T.InstancedMesh) child.dispose();
    }
    const matrix = new T.Matrix4();
    const solid = new T.InstancedMesh(
      this.box,
      this.rock(terrain.planet.kind),
      cellCount,
    );
    const deposits = new T.InstancedMesh(
      this.gem,
      this.color(0xffffff),
      cellCount,
    );
    const color = new T.Color();
    let stone = 0;
    let deposit = 0;
    index = 0;
    for (let x = left; x < right; x++)
      for (let y = top; y < bottom; y++) {
        const tile = cells[index++]!;
        if (!tile) continue;
        const wx = (x + 0.5) * TILE;
        const wy = -(y + 0.5) * TILE;
        matrix
          .makeScale(TILE, TILE, groundDepth)
          .setPosition(wx, wy, -groundDepth / 2);
        solid.setMatrixAt(stone++, matrix);
        if (tile <= 1 || !ores[tile]) continue;
        const seed = hash(x + ":" + y);
        matrix
          .makeScale(4 + (seed % 4), 4.5, 3)
          .setPosition(wx + (seed % 5) - 2, wy + ((seed >>> 8) % 6) - 3, -0.2);
        deposits.setMatrixAt(deposit, matrix);
        deposits.setColorAt(deposit++, color.setHex(ores[tile]!));
      }
    solid.count = stone;
    deposits.count = deposit;
    this.ground.add(solid, deposits);
  }

  private piece(
    kind: BuildItem,
    open: boolean,
    facing: number,
    powered: boolean,
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
    if (kind === "woodWall" || kind === "stoneWall" || kind === "metalWall") {
      const color =
        kind === "woodWall"
          ? 0x634237
          : kind === "stoneWall"
            ? 0x696f7b
            : metal;
      block(color, 0, 8, -14, 16, 16, 3);
      for (const y of [4, 9, 14]) block(0x343741, 0, y, -12.4, 16, 0.42, 0.2);
    } else if (kind === "woodBlock") {
      block(wood, 0, 8, -8, 16, 16, 16);
      for (const y of [2, 7, 12]) block(trim, 0, y, 0, 15, 0.5, 0.32);
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
    const spanY = aspect < 1 ? 285 : 258;
    const spanX = spanY * aspect;
    const { x, y } = frame.camera;
    this.camera.left = -spanX / 2;
    this.camera.right = spanX / 2;
    this.camera.top = spanY / 2;
    this.camera.bottom = -spanY / 2;
    this.camera.position.set(x, -y + 54, 236);
    this.camera.lookAt(x, -y, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.mountains.position.set(
      x * 0.88,
      -terrain.height(Math.floor(x / TILE)) * TILE - 56,
      0,
    );
    this.star.visible = light > 0.03;
    this.star.position.set(
      x + Math.sin(frame.sunPhase) * spanX * 0.32,
      -y - 23 + light * 44,
      -345,
    );
    this.bounds = {
      left: Math.floor((x - spanX / 2) / (4 * TILE)) * 4 - 3,
      right: Math.ceil((x + spanX / 2) / (4 * TILE)) * 4 + 3,
      top: Math.max(0, Math.floor((y - spanY / 2) / (4 * TILE)) * 4 - 4),
      bottom: Math.max(1, Math.ceil((y + spanY / 2) / (4 * TILE)) * 4 + 5),
    };
    this.updateTerrain(frame);
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
      group.position.set(wx, -wy, z);
      return group;
    };
    const { left, right, top, bottom } = this.bounds;
    for (let x = left - 2; x < right; x++)
      for (let y = top; y < bottom; y++) {
        const key = x + "," + y;
        const wall = settlement.walls[key];
        if (wall)
          put(
            "wall:" + key + ":" + wall,
            (x + 0.5) * TILE,
            (y + 1) * TILE,
            0,
            () =>
              this.piece(wall === true ? "woodWall" : wall, false, 1, false),
          );
        const piece = settlement.pieces[key];
        if (piece) {
          const size = isCabinet(piece.kind) ? cabinetWidths[piece.kind] : 1;
          put(
            "piece:" +
              key +
              ":" +
              piece.kind +
              ":" +
              piece.open +
              ":" +
              piece.facing +
              ":" +
              piece.powered,
            (x + size / 2) * TILE,
            (y + 1) * TILE,
            0,
            () =>
              this.piece(
                piece.kind,
                !!piece.open,
                piece.facing,
                !!piece.powered,
              ),
          );
        }
      }
    for (const tree of treesInRange(
      planet,
      terrain,
      left,
      right,
      settlement.cutTrees,
    )) {
      put(
        tree.id + ":" + planet.id,
        (tree.x + 0.5) * TILE,
        tree.ground * TILE,
        -3,
        () => {
          const group = new T.Group();
          const height = tree.height * TILE;
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
          return group;
        },
      );
    }
    const near = (point: Point) =>
      point.x >= left * TILE && point.x <= right * TILE;
    for (const fruit of frame.fruit.filter(near))
      put("fruit:" + fruit.id, fruit.x, fruit.y, 1, () => {
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
        return group;
      });
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
          return group;
        },
      );
      model.rotation.y = animal.facing < 0 ? Math.PI : 0;
      model.position.y += animal.grounded
        ? Math.abs(Math.sin(elapsed * 10 + animal.home))
        : 0;
    }
    frame.drops.filter(near).forEach((drop) =>
      put("drop:" + drop.x + ":" + drop.y, drop.x, drop.y, 1, () => {
        const group = new T.Group();
        this.part(group, this.box, 0xa36c3f, 0, -7, 0, 12, 11, 6);
        this.part(group, this.box, 0xffc87b, 0, -7, 3, 3, 4, 1);
        return group;
      }),
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
    for (const [key, group] of this.meshes)
      if (!seen.has(key)) {
        group.removeFromParent();
        this.meshes.delete(key);
      }
    this.cursor.visible = !!frame.cursor;
    if (frame.cursor) {
      this.cursor.position.set(
        (frame.cursor.x + 0.5) * TILE,
        -(frame.cursor.y + 0.5) * TILE,
        -3,
      );
      this.cursor.scale.set(TILE + 0.3, TILE + 0.3, 8);
      this.cursor.material.color.setHex(
        frame.cursor.valid ? 0x8ff1dd : 0xff816f,
      );
    }
    this.beam.visible = !!frame.beam;
    if (frame.beam) {
      const position = this.beam.geometry.getAttribute("position");
      position.setXYZ(0, frame.beam.x, -frame.beam.y, 3);
      position.setXYZ(1, frame.beam.tx, -frame.beam.ty, 3);
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
        let ceiling = ceilings.get(column);
        if (ceiling === undefined) {
          ceiling = weatherCeiling(terrain, settlement, column);
          ceilings.set(column, ceiling);
        }
        attr.setXYZ(i, px, py < ceiling ? -py : -5000, 8 + (seed % 12));
      }
      attr.needsUpdate = true;
      this.weather.material.color.setHex(
        kind === "acid" ? 0x9cff72 : kind === "snow" ? 0xf3faff : 0x81c6e4,
      );
      this.weather.material.opacity = intensity * 0.76;
    }
    this.targetFrame = frame;
  }

  project(x: number, y: number, z: number, width: number, height: number) {
    const point = this.ndc.set(x, -y, z).project(this.camera);
    return {
      x: Math.round(((point.x + 1) * width) / 2),
      y: Math.round(((1 - point.y) * height) / 2),
    };
  }

  pointAt(nx: number, ny: number, snapTerrain: boolean) {
    if (!this.targetFrame) return;
    this.ray.setFromCamera(this.pointer.set(nx, ny), this.camera);
    const point = this.ray.ray.intersectPlane(this.interactionPlane, this.ndc);
    if (!point) return;
    const wx = point.x,
      wy = -point.y;
    const x = Math.floor(wx / TILE),
      y = Math.floor(wy / TILE);
    const terrain = this.targetFrame.terrain;
    if (snapTerrain && !terrain.get(x, y)) {
      // The top face can extend a few pixels above the front mining plane.
      const rear = this.ray.ray.at(
        (this.ray.ray.origin.z + groundDepth) / -this.ray.ray.direction.z,
        new T.Vector3(),
      );
      const rearY = Math.floor(-rear.y / TILE);
      if (rearY !== y && terrain.get(x, rearY))
        return { wx, wy: rearY * TILE + TILE / 2, x, y: rearY };
    }
    return { wx, wy, x, y };
  }

  dispose() {
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
