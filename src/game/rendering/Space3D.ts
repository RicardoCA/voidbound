import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { landingTerrain } from "./planetTerrain3D";
import { biomes } from "../types";
import { SURFACE_SEQUENCE_DURATION } from "../../stores/game";
import {
  BAY_WIDTH,
  CONSOLE_WIDTH,
  hangarDoor,
  reactorDoor,
} from "../cabin/ColossalInterior";
import { countersFor } from "../station/StationInterior";
import { clothing, type Outfit } from "../../wardrobe/clothing";
import { DOCKING_DURATION, STATION_EXIT_DISTANCE } from "../../stores/game";
import { shipModels } from "../../fleet/models";
import type { Planet, ShipModelId } from "../types";
import { cabinEquipment } from "../cabin/CabinInterior";
import { flight3D, spaceAltitude } from "./flight3D";
import { spaceTexture, type SurfaceFinish } from "./spaceMaterials";
import * as T from "three";
import type { useGame } from "../../stores/game";
import { planetPosition } from "../../universe/generator";
import { starClasses } from "../../universe/stars";
import { hash, random } from "../procedural/random";

type Game = ReturnType<typeof useGame>;

export class Space3D {
  private readonly renderer: T.WebGLRenderer;
  private readonly scene = new T.Scene();
  private readonly stationFloor = new T.CylinderGeometry(1, 1, 1, 48);
  private readonly stationRooms = new Map<
    boolean,
    {
      scene: T.Scene;
      counters: Map<string, T.Group>;
      actor: T.Group;
      outfit: string;
    }
  >();
  private landingPlanet?: T.Mesh;
  private surfaceCinematic?: {
    key: string;
    scene: T.Scene;
    terrain: T.BufferGeometry;
    craft: T.Group;
    ramp: T.Group;
    astronaut: T.Group;
    sky: T.Color;
    fog: T.Fog;
  };
  private jumpScene?: T.Scene;
  private jumpTrails?: T.BufferGeometry;
  private jumpSeeds = Array.from({ length: 230 }, (_, i) => {
    const rng = random(hash("jump:" + i));
    const angle = rng() * Math.PI * 2;
    const radius = 8 + rng() * 560;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      depth: rng() * 1200,
    };
  });
  private carrierRoom?: { key: string; scene: T.Scene; actor: T.Group };
  private mapModel?: T.Group;
  private disposed = false;
  private cabinScene?: T.Scene;
  private outfitKey = "";
  private cabinActor?: T.Group;
  private cabinHatch?: T.Group;
  private readonly cabinCamera = new T.PerspectiveCamera(57, 1, 1, 1900);
  private readonly camera = new T.PerspectiveCamera(65, 1, 1, 10000);
  private readonly objects = new Map<string, T.Object3D>();
  private readonly sphere = new T.SphereGeometry(1, 32, 20);
  private readonly rock = new T.IcosahedronGeometry(1, 1);
  private readonly box = new T.BoxGeometry(1, 1, 1);
  private readonly flame = new T.ConeGeometry(1, 1, 9, 1, true);
  private readonly laser = new T.CylinderGeometry(1, 1, 1, 6);
  private readonly nozzle = new T.CylinderGeometry(0.76, 1, 1, 10, 1, true);
  private readonly profiles = new Map<string, T.BufferGeometry>();
  private readonly materials = new Map<string, T.Material>();
  private readonly textures = new Map<string, T.CanvasTexture>();
  private lastFrame = 0;
  private width = 0;
  private height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const sky = this.texture("sky");
    sky.mapping = T.EquirectangularReflectionMapping;
    this.scene.background = sky;
    this.scene.add(new T.HemisphereLight(0xc4e1ff, 0x30214c, 1.05));
    const sun = new T.DirectionalLight(0xffe3b9, 2.8);
    sun.position.set(300, 450, -500);
    this.scene.add(sun);
    const rng = random(hash("voidbound-3d"));
    const points = new Float32Array(4800);
    for (let i = 0; i < points.length; i++) points[i] = (rng() - 0.5) * 15000;
    const field = new T.BufferGeometry();
    field.setAttribute("position", new T.BufferAttribute(points, 3));
    this.scene.add(
      new T.Points(
        field,
        new T.PointsMaterial({
          color: 0xc6dcff,
          size: 2,
          sizeAttenuation: false,
        }),
      ),
    );
  }

  private texture(finish: SurfaceFinish, seed = 17, biome = 0) {
    const key = `${finish}:${seed}:${biome}`;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = spaceTexture(finish, seed, biome);
      texture.anisotropy = Math.min(
        4,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      this.textures.set(key, texture);
    }
    return texture;
  }

  private material(
    color: number,
    finish: SurfaceFinish = "metal",
    seed = 17,
    biome = 0,
  ) {
    const key = `${color}:${finish}:${seed}:${biome}`;
    let material = this.materials.get(key);
    if (!material) {
      const map = this.texture(finish, seed, biome);
      material =
        finish === "star"
          ? new T.MeshBasicMaterial({ color, map })
          : new T.MeshStandardMaterial({
              color,
              map,
              bumpMap: map,
              bumpScale: finish === "planet" ? 1.2 : 0.65,
              roughness: finish === "metal" ? 0.52 : 0.93,
              metalness: finish === "metal" ? 0.28 : 0,
            });
      this.materials.set(key, material);
    }
    return material;
  }

  private lightMaterial(color: number) {
    const key = "light:" + color;
    let material = this.materials.get(key);
    if (!material) {
      material = new T.MeshBasicMaterial({ color });
      this.materials.set(key, material);
    }
    return material;
  }

  private object(id: string, create: () => T.Object3D, seen: Set<string>) {
    seen.add(id);
    let object = this.objects.get(id);
    if (!object) {
      object = create();
      this.objects.set(id, object);
      this.scene.add(object);
    }
    return object;
  }

  private armor(
    key: string,
    outline: readonly (readonly [number, number])[],
    thickness: number,
  ) {
    let geometry = this.profiles.get(key);
    if (!geometry) {
      const shape = new T.Shape();
      outline.forEach(([x, z], i) =>
        i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
      );
      shape.closePath();
      geometry = new T.ExtrudeGeometry(shape, {
        depth: thickness,
        steps: 1,
        bevelThickness: 0.9,
        bevelSize: 1.1,
        bevelSegments: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) / 32, uv.getY(i) / 32);
      this.profiles.set(key, geometry);
    }
    return geometry;
  }

  private part(
    group: T.Group,
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    w = 1,
    h = 1,
    l = 1,
  ) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, l);
    group.add(mesh);
    return mesh;
  }

  private ship(color: number, heavy = false, controlled = false) {
    const body = new T.Group();
    const armor = this.material(color);
    const dark = this.material(0x455369);
    const stripe = this.material(0xc98839);
    const emissive = new T.MeshBasicMaterial({ color: 0x68efff });
    const glowKey = "engine-blue";
    if (!this.materials.has(glowKey)) this.materials.set(glowKey, emissive);
    else emissive.dispose();
    const glow = this.materials.get(glowKey)!;
    this.part(
      body,
      this.armor(
        "fuselage",
        [
          [-8, 18],
          [-11, 9],
          [-9, -9],
          [-4, -23],
          [0, -27],
          [4, -23],
          [9, -9],
          [11, 9],
          [8, 18],
        ],
        5,
      ),
      armor,
      0,
      -2,
      0,
      heavy ? 1.5 : 1,
      1,
      1,
    );
    this.part(
      body,
      this.armor(
        "canopy",
        [
          [-5, 3],
          [-4, -8],
          [0, -14],
          [4, -8],
          [5, 3],
        ],
        2.5,
      ),
      this.material(0x338b9f),
      0,
      3,
      0,
    );
    const wing = this.armor(
      "swept-wing",
      [
        [0, -10],
        [8, -3],
        [24, 12],
        [22, 17],
        [10, 12],
        [0, 10],
      ],
      1.4,
    );
    for (const side of [-1, 1]) {
      this.part(body, wing, armor, side * 5, -1, 0, side, 1, 1);
      this.part(body, this.box, stripe, side * 21, 1, 10, 4, 0.65, 5);
      const x = side * (heavy ? 12 : 8);
      this.part(body, this.box, dark, x, 1, 10, 7, 7, 20);
      const nozzle = this.part(body, this.nozzle, armor, x, 1, 21, 4, 5, 4);
      nozzle.rotation.x = Math.PI / 2;
      this.part(body, this.sphere, glow, x, 1, 21, 2.6, 2.6, 0.8);
      this.part(body, this.box, stripe, x, 6, 15, 1, 6, 9).rotation.z =
        side * -0.32;
      if (controlled) {
        const exhaust = this.part(
          body,
          this.flame,
          glow,
          x,
          1,
          24,
          2.3,
          1,
          2.3,
        );
        exhaust.rotation.x = Math.PI / 2;
        exhaust.name = "exhaust";
        exhaust.visible = false;
      }
      if (heavy) this.part(body, this.box, armor, side * 20, 1, 1, 10, 10, 27);
    }
    return body;
  }

  private colossal(stage: number) {
    const group = new T.Group();
    const plating = this.material(0x9ba9bb);
    const framework = this.material(0x414d60);
    const markings = this.material(0x9a602b);
    const spine = this.armor(
      "colossal-spine",
      [
        [-32, 82],
        [-43, 57],
        [-35, -38],
        [-24, -75],
        [-10, -112],
        [10, -112],
        [24, -75],
        [35, -38],
        [43, 57],
        [32, 82],
      ],
      18,
    );
    this.part(group, spine, stage === 1 ? framework : plating, 0, -9, 0);
    const shoulder = this.armor(
      "colossal-shoulder",
      [
        [0, -52],
        [21, -45],
        [46, -17],
        [52, 53],
        [36, 77],
        [0, 68],
      ],
      12,
    );
    for (const side of [-1, 1]) {
      this.part(
        group,
        shoulder,
        stage === 1 ? framework : plating,
        side * 26,
        -3,
        0,
        side,
        1,
        1,
      );
      for (const z of [-14, 8, 30]) {
        this.part(group, this.box, framework, side * 64, 10, z, 21, 4, 17);
        this.part(group, this.box, markings, side * 64, 13, z + 7, 17, 1, 2);
      }
      if (stage < 3) continue;
      const nozzle = this.part(
        group,
        this.nozzle,
        framework,
        side * 45,
        0,
        75,
        15,
        23,
        15,
      );
      nozzle.rotation.x = Math.PI / 2;
      this.part(
        group,
        this.sphere,
        this.lightMaterial(0x62ecfa),
        side * 45,
        0,
        81,
        8,
        8,
        2,
      );
      const exhaust = this.part(
        group,
        this.flame,
        this.lightMaterial(0x62ecfa),
        side * 45,
        0,
        81,
        7,
        1,
        7,
      );
      exhaust.rotation.x = Math.PI / 2;
      exhaust.name = "colossal-exhaust";
      exhaust.visible = false;
    }
    if (stage >= 2) {
      this.part(group, this.box, framework, 0, 12, 18, 60, 12, 42);
      this.part(group, this.box, markings, 0, 19, 18, 52, 2, 34);
    }
    if (stage === 3) {
      const bridge = this.armor(
        "colossal-bridge",
        [
          [-15, 10],
          [-18, -1],
          [-11, -14],
          [11, -14],
          [18, -1],
          [15, 10],
        ],
        8,
      );
      this.part(group, bridge, plating, 0, 14, -29);
      this.part(
        group,
        this.box,
        this.lightMaterial(0x7cbdd8),
        0,
        20,
        -42,
        20,
        2,
        2,
      );
    }
    return group;
  }

  private playerShip(id: ShipModelId) {
    const model = shipModels[id];
    const family = model.hullFamily;
    const heavy =
      family === "atlas" || family === "bastion" || family === "mammoth";
    const mining = family === "prospector" || family === "titan";
    const rng = random(hash(id));
    const paint = new T.Color().setHSL(rng(), 0.33, 0.61).getHex();
    const body = this.ship(paint, heavy, true);
    const size =
      family === "viper"
        ? [0.8, 0.85, 1.23]
        : heavy
          ? [1.18, 1.27, 1.18]
          : [1, 1, 1];
    body.scale.set(
      size[0]! * (0.92 + rng() * 0.16),
      size[1]!,
      size[2]! * (0.9 + rng() * 0.2),
    );
    for (const side of [-1, 1]) {
      if (mining) {
        this.part(
          body,
          this.box,
          this.material(0xc98839),
          side * 13,
          1,
          -13,
          6,
          7,
          18,
        );
        const head = this.part(
          body,
          this.nozzle,
          this.material(0x526173),
          side * 13,
          1,
          -23,
          3,
          7,
          3,
        );
        head.rotation.x = -Math.PI / 2;
      } else if (family === "viper") {
        this.part(
          body,
          this.box,
          this.material(paint),
          side * 14,
          4,
          11,
          1.5,
          9,
          14,
        ).rotation.z = side * -0.5;
      }
      this.part(
        body,
        this.box,
        this.lightMaterial(side < 0 ? 0xff524f : 0x52e59a),
        side * 25,
        1,
        11,
        1.5,
        1,
        2,
      );
    }
    const variant = new T.Group();
    variant.add(...body.children);
    variant.scale.copy(body.scale);
    return variant;
  }

  private station(clandestine: boolean) {
    const group = new T.Group();
    const hull = this.material(clandestine ? 0x815563 : 0x94a6bd);
    const framework = this.material(0x454f63);
    const panels = this.material(0x355980);
    const dock = this.armor(
      "station-dock",
      [
        [-34, 63],
        [-43, 39],
        [-43, -31],
        [-25, -62],
        [25, -62],
        [43, -31],
        [43, 39],
        [34, 63],
      ],
      22,
    );
    this.part(group, dock, hull, 0, -16, 0);
    this.part(group, this.box, framework, 0, -1, 65, 38, 18, 4);
    this.part(
      group,
      this.box,
      this.lightMaterial(0xe5b071),
      0,
      10,
      67,
      31,
      2,
      2,
    );
    for (const side of [-1, 1]) {
      this.part(group, this.box, framework, side * 46, 1, 0, 48, 8, 18);
      if (clandestine) {
        const pod = this.part(
          group,
          this.nozzle,
          hull,
          side * 66,
          3,
          side * 23,
          22,
          48,
          22,
        );
        pod.rotation.x = Math.PI / 2;
        this.part(
          group,
          this.box,
          this.lightMaterial(0xec5746),
          side * 66,
          5,
          43,
          13,
          3,
          2,
        );
      } else {
        this.part(group, this.box, hull, side * 59, 4, 0, 25, 20, 51);
        for (const z of [-20, 20])
          this.part(group, this.box, panels, side * 86, 6, z, 35, 2, 28);
      }
    }
    this.part(group, this.box, framework, 0, 15, -19, 28, 15, 31);
    this.part(
      group,
      this.box,
      this.lightMaterial(clandestine ? 0xec5746 : 0x7bcbd7),
      0,
      18,
      -2,
      22,
      3,
      2,
    );
    this.part(
      group,
      this.box,
      framework,
      clandestine ? -11 : 0,
      27,
      -20,
      3,
      20,
      3,
    );
    return group;
  }

  private resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return false;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    return true;
  }

  private buildCabin() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x080e1b);
    scene.add(new T.HemisphereLight(0xc9e8ff, 0x556076, 1.7));
    const light = new T.DirectionalLight(0xffe5c1, 2.3);
    light.position.set(-80, 150, 60);
    scene.add(light);
    const room = new T.Group();
    const steel = this.material(0xc1c8d9);
    const dark = this.material(0x273757);
    const trim = this.material(0xa36d47);
    const cyan = this.lightMaterial(0x36dcff);
    const deck = this.material(0x344a69);
    const floor = this.armor(
      "cabin-deck",
      [
        [-206, 65],
        [-205, -25],
        [-154, -75],
        [154, -75],
        [205, -25],
        [206, 65],
      ],
      5,
    );
    this.part(room, floor, deck, 0, -6, 0);
    for (let x = -180; x <= 180; x += 40) {
      this.part(room, this.box, dark, x, 10, -64, 39, 22, 8);
      this.part(room, this.box, steel, x, 22, -64, 39, 4, 8);
      this.part(room, this.box, cyan, x, 24, -59, 37, 1, 1);
      this.part(room, this.box, steel, x, 62, -69, 39, 3, 25).rotation.x = 0.22;
      this.part(
        room,
        this.box,
        this.lightMaterial(0xffe4b7),
        x,
        59,
        -57,
        13,
        1,
        3,
      );
      this.part(room, this.box, dark, x, -0.55, 4, 1, 0.3, 112);
    }
    for (const x of [-195, -131, -65, 0, 65, 131, 195])
      this.part(room, this.box, steel, x, 43, -67, 3, 40, 4).rotation.z =
        x / 1200;
    for (const side of [-1, 1]) {
      const wall = this.part(
        room,
        this.box,
        dark,
        side * 196,
        11,
        -25,
        7,
        24,
        75,
      );
      wall.rotation.y = side * 0.22;
      this.part(
        room,
        this.box,
        cyan,
        side * 193,
        23,
        -25,
        2,
        1,
        70,
      ).rotation.y = side * 0.22;
    }
    const sky = this.texture("sky");
    scene.background = sky;
    const starlight = this.scene.children.find(
      (object) => object instanceof T.Points,
    );
    if (starlight) scene.add(starlight.clone());
    const vista = new T.Group();
    vista.position.set(66, 106, -420);
    this.part(
      vista,
      this.sphere,
      this.material(0xdb936e, "planet", 23, 1),
      0,
      0,
      0,
      57,
      57,
      57,
    );
    this.part(
      vista,
      this.sphere,
      this.material(0x96bae3, "planet", 17, 2),
      -115,
      5,
      -140,
      29,
      29,
      29,
    );
    scene.add(vista);

    const consoleShape = this.armor(
      "cabin-console",
      [
        [-12, 5],
        [-14, -3],
        [-10, -10],
        [10, -10],
        [14, -3],
        [12, 5],
      ],
      7,
    );
    const seatShape = this.armor(
      "cabin-seat",
      [
        [-6, 5],
        [-8, 0],
        [-6, -5],
        [6, -5],
        [8, 0],
        [6, 5],
      ],
      3,
    );
    for (const [id, fixture] of Object.entries(cabinEquipment)) {
      const prop = new T.Group();
      prop.position.set(fixture.x, 0, fixture.y);
      const screen = this.lightMaterial(fixture.color);
      if (id === "hatch") {
        this.part(prop, this.box, dark, 0, 19, -13, 24, 38, 7);
        this.part(prop, this.box, steel, 0, 19, -8, 17, 31, 5);
        this.part(prop, this.box, screen, 7, 20, -5, 2, 9, 1);
        this.cabinHatch = prop;
      } else if (id === "inventory") {
        this.part(prop, this.box, steel, 0, 9, 8, 23, 18, 13);
        this.part(prop, this.box, dark, 0, 9, 1, 19, 14, 2);
        this.part(prop, this.box, screen, 5, 10, 0, 4, 2, 1);
      } else if (id === "map") {
        const base = this.part(prop, this.box, dark, 0, 4, -7, 18, 8, 11);
        const display = this.part(prop, this.box, screen, 0, 8, -7, 15, 1, 8);
        void new GLTFLoader()
          .loadAsync(import.meta.env.BASE_URL + "models/mapa-galactico.glb")
          .then(({ scene: model }) => {
            if (this.disposed) {
              this.disposeMap(model);
              return;
            }
            const bounds = new T.Box3().setFromObject(model);
            const size = bounds.getSize(new T.Vector3());
            const center = bounds.getCenter(new T.Vector3());
            const scale = Math.min(22 / size.x, 20 / size.y, 18 / size.z);
            model.scale.setScalar(scale);
            model.position.set(
              -center.x * scale,
              -bounds.min.y * scale,
              -7 - center.z * scale,
            );
            prop.add(model);
            this.mapModel = model;
            base.visible = display.visible = false;
          })
          .catch((error: unknown) =>
            console.warn("Mapa galáctico 3D indisponível.", error),
          );
      } else {
        this.part(prop, consoleShape, dark, 0, 1, -8);
        this.part(prop, consoleShape, steel, 0, 8, -9);
        for (let i = -2; i <= 2; i++)
          this.part(
            prop,
            this.box,
            i % 2 ? cyan : screen,
            i * 3.6,
            15.2,
            -4,
            1.8,
            0.5,
            1.2,
          );
        this.part(prop, this.box, steel, 0, 15, -10, 24, 5, 8).rotation.x =
          -0.3;
        this.part(prop, this.box, screen, 0, 18, -10, 15, 2, 6).rotation.x =
          -0.3;
        if (id === "pilot") {
          for (const side of [-1, 1]) {
            const x = side * 9;
            this.part(prop, seatShape, steel, x, 4, 9);
            this.part(prop, seatShape, trim, x, 7, 9, 0.76, 0.6, 0.7);
            this.part(prop, this.box, dark, x, 13, 13, 10, 13, 3).rotation.x =
              -0.16;
            this.part(prop, this.box, cyan, x, 12, 15, 7, 3, 1);
          }
        }
      }
      room.add(prop);
    }
    scene.add(room);
    return scene;
  }

  private dressedPilot(outfit: Outfit = {}) {
    const actor = new T.Group();
    const shirt = outfit.shirt ? clothing[outfit.shirt] : undefined;
    const pants = outfit.pants ? clothing[outfit.pants] : undefined;
    const helmet = outfit.helmet ? clothing[outfit.helmet] : undefined;
    const visor = outfit.visor ? clothing[outfit.visor] : undefined;
    const hat = outfit.hat ? clothing[outfit.hat] : undefined;
    const torso = this.material(shirt?.color ?? 0xd5d4c7);
    this.part(actor, this.box, torso, 0, 10, 0, 7, 8, 5);
    this.part(
      actor,
      this.box,
      this.material(shirt?.trim ?? 0x506170),
      0,
      7,
      -2.55,
      7,
      1,
      0.4,
    );
    if (shirt && "skull" in shirt && shirt.skull) {
      const bone = this.lightMaterial(0xe2dac8);
      this.part(actor, this.box, bone, 0, 11.7, -2.65, 3.5, 2.7, 0.4);
      this.part(actor, this.box, bone, 0, 10, -2.65, 2, 0.8, 0.4);
      for (const x of [-0.8, 0.8])
        this.part(
          actor,
          this.box,
          this.lightMaterial(0x28232c),
          x,
          12,
          -2.9,
          0.65,
          0.65,
          0.3,
        );
    }
    const shell = helmet && "shell" in helmet ? helmet.shell : undefined;
    const helmetWidth =
      shell === "armored" ? 7.4 : shell === "scout" ? 5.7 : 6.5;
    this.part(
      actor,
      this.sphere,
      this.material(helmet?.color ?? 0xd5d4c7),
      0,
      17,
      0,
      helmetWidth / 2,
      3.4,
      3.1,
    );
    this.part(
      actor,
      this.box,
      this.material(helmet?.trim ?? 0x506170),
      0,
      15.4,
      0,
      helmetWidth,
      0.8,
      4.4,
    );
    this.part(
      actor,
      this.box,
      this.lightMaterial(visor?.color ?? 0x6daeab),
      0,
      17,
      -2.8,
      4.8,
      2.1,
      1,
    );
    if (visor)
      this.part(
        actor,
        this.box,
        this.lightMaterial(visor.trim),
        0,
        17.7,
        -3.35,
        4,
        0.28,
        0.2,
      );
    if (hat) {
      this.part(
        actor,
        this.sphere,
        this.material(hat.color),
        0,
        20.2,
        0,
        3.8,
        1.7,
        3.7,
      );
      this.part(
        actor,
        this.box,
        this.material(hat.trim),
        0,
        19.8,
        -3.25,
        6.5,
        0.55,
        3.1,
      );
    }
    for (const side of [-1, 1]) {
      this.part(actor, this.box, torso, side * 4.4, 10, 0, 2.1, 6.5, 3);
      const leg = new T.Group();
      leg.position.set(side * 2, 6, 0);
      leg.name = "leg";
      this.part(
        leg,
        this.box,
        this.material(pants?.color ?? 0x394758),
        0,
        -2.2,
        0,
        3,
        5.3,
        3.5,
      );
      this.part(
        leg,
        this.box,
        this.material(pants?.trim ?? 0x283443),
        0,
        -5.2,
        -0.5,
        3.2,
        1.5,
        4.3,
      );
      actor.add(leg);
    }
    return actor;
  }

  private buildStationInterior(clandestine: boolean) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x080d18);
    scene.add(new T.HemisphereLight(0xcce5ff, 0x36374e, 1.6));
    const key = new T.DirectionalLight(clandestine ? 0xffc1a0 : 0xd9f4ff, 2.2);
    key.position.set(-140, 220, 90);
    scene.add(key);
    const room = new T.Group();
    scene.add(room);
    const shell = this.material(clandestine ? 0x684c56 : 0x687d92);
    const deck = this.material(clandestine ? 0x55434c : 0x465b70);
    const trim = this.material(0x344454);
    const strip = this.lightMaterial(clandestine ? 0xc45943 : 0x66d9ec);
    this.part(room, this.stationFloor, shell, 0, -11, 0, 361, 18, 195);
    this.part(room, this.stationFloor, deck, 0, -2, 0, 354, 4, 188);
    // Keep the near side open so the camera can see the walkable floor.
    for (let i = 0; i < 18; i++) {
      const angle = Math.PI + ((i + 0.5) * Math.PI) / 18;
      const x = Math.cos(angle) * 350;
      const z = Math.sin(angle) * 184;
      const rotation = Math.atan2(
        -184 * Math.cos(angle),
        -350 * Math.sin(angle),
      );
      this.part(room, this.box, shell, x, 30, z, 63, 62, 8).rotation.y =
        rotation;
      this.part(room, this.box, trim, x, 30, z + 5, 38, 32, 5).rotation.y =
        rotation;
      this.part(room, this.box, strip, x, 54, z + 6, 31, 3, 5).rotation.y =
        rotation;
    }
    for (const z of [-109, -89, 90, 110])
      for (const x of [-220, -110, 0, 110, 220])
        this.part(room, this.box, strip, x, 0.15, z, 53, 0.3, 1.5);
    const counters = new Map<string, T.Group>();
    for (const { npc, x, y } of countersFor(clandestine)) {
      const kiosk = new T.Group();
      kiosk.position.set(x, 0, y - 23);
      const accent = this.lightMaterial(npc.color);
      this.part(kiosk, this.box, trim, 0, 6, 0, 46, 12, 12);
      this.part(kiosk, this.box, shell, 0, 13, 0, 48, 3, 14);
      this.part(kiosk, this.box, accent, 0, 10, 6.2, 33, 2, 1);
      this.part(kiosk, this.box, trim, 14, 17, -2, 10, 6, 7);
      this.part(kiosk, this.box, accent, 14, 18, 2, 7, 3, 0.8);
      const attendant = new T.Group();
      attendant.position.set(-6, 0, -13);
      this.part(
        attendant,
        this.box,
        this.material(npc.color),
        0,
        14,
        0,
        9,
        15,
        6,
      );
      this.part(
        attendant,
        this.sphere,
        this.material(0xc0a18a),
        0,
        24,
        0,
        4,
        5,
        4,
      );
      this.part(attendant, this.box, trim, 0, 4, 0, 7, 8, 5);
      kiosk.add(attendant);
      room.add(kiosk);
      counters.set(npc.id, kiosk);
    }
    const actor = this.dressedPilot();
    scene.add(actor);
    return { scene, counters, actor, outfit: "" };
  }

  drawStationInterior(g: Game) {
    if (!this.resize()) return;
    const clandestine = g.system.station?.kind === "clandestine";
    let room = this.stationRooms.get(clandestine);
    if (!room) {
      room = this.buildStationInterior(clandestine);
      this.stationRooms.set(clandestine, room);
    }
    const outfit = g.state.wardrobe?.equipped;
    const outfitKey = JSON.stringify(outfit ?? {});
    if (outfitKey !== room.outfit) {
      room.scene.remove(room.actor);
      room.actor = this.dressedPilot(outfit);
      room.scene.add(room.actor);
      room.outfit = outfitKey;
    }
    const { x, z, heading, stride } = flight3D.station;
    room.actor.position.set(x, 0, z);
    room.actor.rotation.y +=
      Math.atan2(
        Math.sin(heading - room.actor.rotation.y),
        Math.cos(heading - room.actor.rotation.y),
      ) * 0.24;
    for (const leg of room.actor.children)
      if (leg.name === "leg")
        leg.rotation.x = Math.sin(stride) * Math.sign(leg.position.x) * 0.5;
    const aspect = this.width / this.height;
    this.cabinCamera.aspect = aspect;
    this.cabinCamera.position.set(x * 0.85, 190, z * 0.7 + 210);
    this.cabinCamera.lookAt(x * 0.85, 8, z * 0.7 - 27);
    this.cabinCamera.updateProjectionMatrix();
    this.renderer.render(room.scene, this.cabinCamera);
    const counter = room.counters.get(g.panel.slice("station:".length));
    if (g.panel.startsWith("station:") && counter) {
      const point = new T.Vector3(
        counter.position.x - 6,
        33,
        counter.position.z - 13,
      ).project(this.cabinCamera);
      const anchor = {
        x: Math.round(((point.x + 1) * this.width) / 2),
        y: Math.round(((1 - point.y) * this.height) / 2),
        width: this.width,
        height: this.height,
      };
      const old = g.stationDialogueAnchor;
      if (
        anchor.x !== old.x ||
        anchor.y !== old.y ||
        anchor.width !== old.width ||
        anchor.height !== old.height
      )
        g.stationDialogueAnchor = anchor;
    }
  }

  drawCabin(inFlight: boolean, outfit?: Outfit) {
    if (!this.resize()) return;
    this.cabinScene ??= this.buildCabin();
    const key = JSON.stringify(outfit ?? {});
    if (!this.cabinActor || this.outfitKey !== key) {
      const heading = this.cabinActor?.rotation.y ?? flight3D.cabin.heading;
      if (this.cabinActor) this.cabinScene.remove(this.cabinActor);
      this.cabinActor = this.dressedPilot(outfit);
      this.cabinActor.rotation.y = heading;
      this.cabinScene.add(this.cabinActor);
      this.outfitKey = key;
    }
    const { x, z, stride, heading } = flight3D.cabin;
    this.cabinActor!.position.set(x, 0, z);
    const rotation = this.cabinActor!.rotation;
    const delta = heading - rotation.y;
    rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * 0.24;
    for (const leg of this.cabinActor!.children)
      if (leg.name === "leg")
        leg.rotation.x = Math.sin(stride) * Math.sign(leg.position.x) * 0.5;
    this.cabinHatch!.visible = !inFlight;
    const aspect = this.width / this.height;
    const distance = aspect < 1.5 ? 125 / Math.max(aspect, 0.5) + 70 : 146;
    this.cabinCamera.aspect = aspect;
    this.cabinCamera.position.set(x * 0.78, 60, z * 0.25 + distance);
    this.cabinCamera.lookAt(x * 0.73, 15, -15);
    this.cabinCamera.updateProjectionMatrix();
    this.renderer.render(this.cabinScene, this.cabinCamera);
  }

  drawColossalInterior(g: Game) {
    const carrier = g.localColossal;
    if (!carrier || !this.resize()) return;
    const { room, x, z, heading, stride } = flight3D.colossal;
    const ships = [
      g.state.activeShip.model,
      ...g.state.parkedShips
        .filter((ship) => carrier.ships.includes(ship.id))
        .map((ship) => ship.model),
    ];
    const key = JSON.stringify([
      room,
      carrier.slots,
      ships,
      g.state.wardrobe?.equipped,
    ]);
    if (this.carrierRoom?.key !== key) {
      const scene = new T.Scene();
      scene.background = this.texture("sky");
      scene.add(new T.HemisphereLight(0xbddff8, 0x535266, 1.9));
      const lamp = new T.DirectionalLight(0xffe2bd, 2.5);
      lamp.position.set(200, 190, 145);
      scene.add(lamp);
      const deck = new T.Group();
      scene.add(deck);
      deck.scale.set(1.45, 1.24, 1.55);
      const steel = this.material(0x91a5bd);
      const dark = this.material(0x344357);
      const amber = this.lightMaterial(0xe2aa57);
      const cyan = this.lightMaterial(0x66d9ed);
      const box = (
        material: T.Material,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        l: number,
      ) => this.part(deck, this.box, material, x, y, z, w, h, l);
      const door = (x: number, light: T.Material) => {
        box(dark, x, 21, -15, 41, 42, 8);
        box(steel, x - 9, 20, -10, 16, 36, 3);
        box(steel, x + 9, 20, -10, 16, 36, 3);
        box(light, x, 39, -10, 27, 2, 2);
        box(light, x, 20, -8, 1.5, 28, 1);
      };
      const terminal = (x: number, light: T.Material) => {
        box(dark, x, 7, -8, 32, 14, 15);
        box(steel, x, 15, -8, 34, 3, 16);
        box(light, x, 17, -12, 23, 1, 6).rotation.x = -0.26;
      };
      const width = room === "hangar" ? reactorDoor(carrier.slots) + 51 : 480;
      for (let left = 0; left < width; left += 48) {
        const span = Math.min(48, width - left);
        const center = left + span / 2;
        box(steel, center, -3, -9, span, 6, 116);
        box(dark, center, 25, -66, span, 50, 8);
        box(steel, center - span / 2, 27, -60, 3, 55, 5);
        box(cyan, center, 49, -60, span * 0.65, 2, 3);
        box(amber, center, 0.15, 29, span * 0.7, 0.3, 2);
      }
      if (room === "hangar") {
        terminal(48, amber);
        for (let i = 0; i < carrier.slots; i++) {
          const bx = CONSOLE_WIDTH + (i + 0.5) * BAY_WIDTH;
          box(dark, bx, 0.5, -31, 70, 1, 50);
          for (const side of [-1, 1])
            box(amber, bx + side * 34, 2, -28, 1.5, 2, 43);
          const model = ships[i];
          if (!model) continue;
          const berthed = this.playerShip(model);
          berthed.position.set(bx, 6, -32);
          berthed.rotation.y = Math.PI * 0.5;
          berthed.scale.multiplyScalar(0.8);
          deck.add(berthed);
        }
        door(hangarDoor(carrier.slots), cyan);
        door(reactorDoor(carrier.slots), amber);
      } else if (room === "bridge") {
        door(44, cyan);
        terminal(210, cyan);
        terminal(340, amber);
        box(dark, 340, 6, 3, 12, 12, 10);
        box(steel, 340, 14, 7, 12, 14, 3);
        for (const side of [-1, 1])
          box(cyan, 210 + side * 16, 20, -15, 2, 7, 2);
      } else {
        door(44, cyan);
        terminal(240, amber);
        const core = this.part(
          deck,
          this.stationFloor,
          cyan,
          240,
          27,
          -42,
          19,
          42,
          19,
        );
        core.rotation.z = Math.PI / 2;
        for (const offset of [-28, 28]) {
          const housing = this.part(
            deck,
            this.stationFloor,
            steel,
            240 + offset,
            27,
            -42,
            22,
            12,
            22,
          );
          housing.rotation.z = Math.PI / 2;
          box(dark, 240 + offset, 7, -42, 14, 14, 21);
        }
        box(this.lightMaterial(0xb58af5), 250, 18, -7, 7, 1, 5);
      }
      const actor = this.dressedPilot(g.state.wardrobe?.equipped);
      scene.add(actor);
      this.carrierRoom = { key, scene, actor };
    }
    const { actor, scene } = this.carrierRoom;
    actor.position.set(x * 1.45, 0, z * 1.55);
    const turn = heading - actor.rotation.y;
    actor.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * 0.24;
    for (const leg of actor.children)
      if (leg.name === "leg")
        leg.rotation.x = Math.sin(stride) * Math.sign(leg.position.x) * 0.5;
    this.cabinCamera.aspect = this.width / this.height;
    this.cabinCamera.position.set(actor.position.x, 88, actor.position.z + 143);
    this.cabinCamera.lookAt(actor.position.x, 17, actor.position.z - 36);
    this.cabinCamera.updateProjectionMatrix();
    this.renderer.render(scene, this.cabinCamera);
  }

  drawSurfaceCinematic(g: Game) {
    const sequence = g.surfaceSequence;
    if (!sequence || !this.resize()) return;
    const planet = g.planet;
    const model = g.state.activeShip.model;
    const key = JSON.stringify([
      planet.id,
      sequence.landingX,
      model,
      g.state.wardrobe?.equipped,
    ]);
    const biome = biomes[planet.kind] ?? biomes[0];
    if (this.surfaceCinematic?.key !== key) {
      this.surfaceCinematic?.terrain.dispose();
      const scene = new T.Scene();
      const sky = new T.Color(biome.daySky);
      const fog = new T.Fog(sky, 210, 880);
      scene.background = sky;
      scene.fog = fog;
      scene.add(new T.HemisphereLight(0xe5f0ff, biome.ground, 1.8));
      const sun = new T.DirectionalLight(0xffdfaa, 2.7);
      sun.position.set(-160, 230, -90);
      scene.add(sun);
      const terrain = landingTerrain(planet, sequence.landingX);
      scene.add(
        new T.Mesh(terrain, this.material(biome.color, "rock", planet.kind)),
      );
      const craft = this.playerShip(model);
      scene.add(craft);
      const ramp = new T.Group();
      ramp.position.set(12, 6, 0);
      this.part(ramp, this.box, this.material(0x63758a), 8, 0, 0, 16, 1, 9);
      for (const z of [-4, 4])
        this.part(
          ramp,
          this.box,
          this.lightMaterial(0xe2aa57),
          8,
          0.6,
          z,
          15,
          0.4,
          0.5,
        );
      const astronaut = this.dressedPilot(g.state.wardrobe?.equipped);
      astronaut.scale.setScalar(0.65);
      scene.add(ramp, astronaut);
      this.surfaceCinematic = {
        key,
        scene,
        terrain,
        craft,
        ramp,
        astronaut,
        sky,
        fog,
      };
    }
    const { scene, craft, ramp, astronaut, sky, fog } = this.surfaceCinematic;
    const progress = T.MathUtils.clamp(
      sequence.elapsed / SURFACE_SEQUENCE_DURATION[sequence.kind],
      0,
      1,
    );
    const disembarking = sequence.kind === "disembark";
    ramp.visible = disembarking;
    astronaut.visible = disembarking && progress > 0.22;
    if (disembarking) {
      craft.position.set(0, 6, 0);
      craft.rotation.set(0, Math.PI, 0);
      for (const part of craft.children)
        if (part.name === "exhaust") part.visible = false;
      const opening = T.MathUtils.smoothstep(progress, 0, 0.27);
      ramp.rotation.z = T.MathUtils.lerp(1.4, -Math.asin(6 / 16), opening);
      const walk = T.MathUtils.smoothstep(progress, 0.22, 1);
      astronaut.position.set(12 + 31 * walk, Math.max(0, 6 - walk * 12), 0);
      astronaut.rotation.y = -Math.PI / 2;
      for (const leg of astronaut.children)
        if (leg.name === "leg")
          leg.rotation.x =
            Math.sin(walk * Math.PI * 6) * Math.sign(leg.position.x) * 0.55;
      sky.setHex(biome.daySky);
      fog.color.copy(sky);
      this.cabinCamera.aspect = this.width / this.height;
      this.cabinCamera.position.set(44 + walk * 10, 30, 63);
      this.cabinCamera.lookAt(9 + walk * 16, 7, 0);
      this.cabinCamera.updateProjectionMatrix();
      this.renderer.render(scene, this.cabinCamera);
      return;
    }
    const takingOff = sequence.kind === "takeoff";
    const flight = takingOff ? 1 - (1 - progress) ** 2 : (1 - progress) ** 2;
    const altitude = takingOff ? 480 * progress ** 1.7 : 230 * flight;
    craft.position.set(0, 6 + altitude, -310 * flight);
    craft.rotation.set(
      (takingOff ? 0.37 : -0.17) * flight,
      takingOff ? 0 : Math.PI,
      0,
    );
    for (const part of craft.children) {
      if (part.name !== "exhaust") continue;
      const power = takingOff
        ? Math.min(1, progress * 12)
        : Math.min(1, (1 - progress) * 8);
      const length =
        (21 + Math.sin(sequence.elapsed * 43 + part.position.x) * 4) * power;
      part.visible = power > 0.03;
      part.scale.y = length;
      part.position.z = 21 + length / 2;
    }
    sky
      .setHex(biome.daySky)
      .lerp(new T.Color(0x080e21), Math.min(1, altitude / 420));
    fog.color.copy(sky);
    this.cabinCamera.aspect = this.width / this.height;
    this.cabinCamera.position.set(
      115,
      craft.position.y + 48,
      craft.position.z + 118,
    );
    this.cabinCamera.lookAt(0, craft.position.y - 9, craft.position.z - 16);
    this.cabinCamera.updateProjectionMatrix();
    this.renderer.render(scene, this.cabinCamera);
  }

  drawLandingComputer(planet: Planet) {
    this.drawCockpit(0, planet);
  }

  drawJump(progress: number) {
    this.drawCockpit(progress);
  }

  private drawCockpit(progress: number, planet?: Planet) {
    if (!this.resize()) return;
    if (!this.jumpScene) {
      const scene = new T.Scene();
      scene.background = this.texture("sky");
      scene.add(new T.HemisphereLight(0xbcdfff, 0x554479, 1.6));
      const light = new T.DirectionalLight(0xbfefff, 2.7);
      light.position.set(0, 50, -15);
      scene.add(light);
      const cockpit = new T.Group();
      const shell = this.material(0x68778e);
      const console = this.material(0x303c53);
      const cyan = this.lightMaterial(0x60dfef);
      this.part(cockpit, this.box, shell, 0, -22, -40, 120, 15, 30);
      this.part(
        cockpit,
        this.box,
        console,
        0,
        -13,
        -49,
        105,
        5,
        13,
      ).rotation.x = -0.22;
      this.part(cockpit, this.box, shell, 0, 26, -44, 115, 7, 12);
      for (const side of [-1, 1]) {
        this.part(
          cockpit,
          this.box,
          shell,
          side * 35,
          5,
          -44,
          5,
          49,
          7,
        ).rotation.z = side * 0.18;
        this.part(
          cockpit,
          this.box,
          cyan,
          side * 34,
          4,
          -39,
          1,
          41,
          1,
        ).rotation.z = side * 0.18;
        this.part(
          cockpit,
          this.box,
          cyan,
          side * 16,
          -10,
          -49,
          18,
          1,
          5,
        ).rotation.x = -0.22;
        for (let i = 0; i < 5; i++)
          this.part(
            cockpit,
            this.box,
            this.lightMaterial(i % 2 ? 0xffa664 : 0x79eba9),
            side * (8 + i * 4),
            -11,
            -43,
            2.2,
            1,
            1.8,
          );
      }
      scene.add(cockpit);
      this.jumpTrails = new T.BufferGeometry();
      this.jumpTrails.setAttribute(
        "position",
        new T.BufferAttribute(
          new Float32Array(this.jumpSeeds.length * 6),
          3,
        ).setUsage(T.DynamicDrawUsage),
      );
      const trails = new T.LineSegments(
        this.jumpTrails,
        new T.LineBasicMaterial({ color: 0xa9deff }),
      );
      trails.frustumCulled = false;
      this.materials.set("jump-trails", trails.material);
      scene.add(trails);
      this.jumpScene = scene;
    }
    const trails = this.jumpScene.children.find(
      (object) => object instanceof T.LineSegments,
    )!;
    trails.visible = !planet;
    if (planet) {
      this.landingPlanet ??= new T.Mesh(this.sphere);
      if (!this.landingPlanet.parent) this.jumpScene.add(this.landingPlanet);
      this.landingPlanet.visible = true;
      this.landingPlanet.material = this.material(
        0xe6d9cf,
        "planet",
        17 + (planet.seed % 4),
        planet.kind,
      );
      this.landingPlanet.position.set(0, 28, -155);
      this.landingPlanet.scale.setScalar(29);
      this.landingPlanet.rotation.y = performance.now() / 38000;
    } else if (this.landingPlanet) {
      this.landingPlanet.visible = false;
    }
    const t = T.MathUtils.clamp(progress, 0, 1);
    const power = Math.sin(t * Math.PI) ** 0.6;
    const position = this.jumpTrails!.getAttribute("position");
    this.jumpSeeds.forEach(({ x, y, depth }, i) => {
      const z = -55 - ((depth + 1200 - ((t * t * 5400) % 1200)) % 1200);
      position.setXYZ(i * 2, x, y, z);
      position.setXYZ(i * 2 + 1, x, y, z - (3 + 230 * power));
    });
    position.needsUpdate = true;
    this.cabinCamera.aspect = this.width / this.height;
    this.cabinCamera.position.set(
      Math.sin(t * 89) * power * 0.48,
      Math.cos(t * 75) * power * 0.38,
      0,
    );
    this.cabinCamera.lookAt(0, planet ? 9 : 0, -100);
    this.cabinCamera.updateProjectionMatrix();
    this.renderer.render(this.jumpScene, this.cabinCamera);
  }

  draw(g: Game) {
    if (!this.resize()) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const seen = new Set<string>();
    const ship = g.state.ship;
    const dx = Math.cos(ship.angle);
    const dz = Math.sin(ship.angle);
    const modelId = g.state.activeShip.model;
    const pilotedCarrier = g.colossalHelm ? g.localColossal : undefined;
    const player = this.object(
      "player:" + modelId,
      () => this.playerShip(modelId),
      seen,
    );
    const { altitude, pitch, thrust } = flight3D;
    const horizontal = Math.cos(pitch);
    const vertical = Math.sin(pitch);
    player.visible = !pilotedCarrier;
    player.position.set(ship.x, altitude, ship.y);
    player.rotation.set(pitch, Math.atan2(-dx, -dz), 0, "YXZ");
    const burning = thrust && !g.paused && !g.panel && ship.fuel > 0;
    for (const child of player.children) {
      if (child.name !== "exhaust") continue;
      const length =
        23 + Math.sin(performance.now() / 39 + child.position.x) * 5;
      child.visible = burning;
      child.scale.y = length;
      child.position.z = 21 + length / 2;
    }
    this.camera.position.set(
      ship.x - dx * horizontal * 103,
      altitude - vertical * 103 + 45,
      ship.y - dz * horizontal * 103,
    );
    this.camera.lookAt(
      ship.x + dx * horizontal * 90,
      altitude + vertical * 90,
      ship.y + dz * horizontal * 90,
    );

    const docking = g.dockingSequence;
    const dock = g.system.station;
    if (docking && dock) {
      const progress = T.MathUtils.clamp(
        docking.elapsed / DOCKING_DURATION,
        0,
        1,
      );
      const t = progress * progress * (3 - 2 * progress);
      const departure = docking.kind === "departure";
      const mouth = new T.Vector3(dock.x, 0, dock.y + 84);
      const path = departure
        ? new T.CubicBezierCurve3(
            mouth,
            new T.Vector3(dock.x, 0, dock.y + 180),
            new T.Vector3(dock.x + STATION_EXIT_DISTANCE - 60, 0, dock.y + 10),
            new T.Vector3(dock.x + STATION_EXIT_DISTANCE, 0, dock.y),
          )
        : new T.CubicBezierCurve3(
            new T.Vector3(ship.x, 0, ship.y),
            new T.Vector3(ship.x, 38, dock.y + 145),
            new T.Vector3(dock.x, 0, dock.y + 140),
            mouth,
          );
      player.position.copy(path.getPoint(t));
      const direction = path.getTangent(t);
      player.rotation.set(0, Math.atan2(-direction.x, -direction.z), 0);
      player.scale
        .copy((player.userData.baseScale ??= player.scale.clone()))
        .multiplyScalar(
          departure
            ? T.MathUtils.lerp(0.55, 1, t)
            : T.MathUtils.lerp(1, 0.55, t),
        );
      this.camera.position.set(
        dock.x + (departure ? 170 : -155),
        85,
        dock.y + 228,
      );
      this.camera.lookAt(
        dock.x + (player.position.x - dock.x) * 0.45,
        0,
        dock.y + 56,
      );
      for (const exhaust of player.children)
        if (exhaust.name === "exhaust")
          exhaust.visible = departure && !g.paused;
    } else {
      player.scale
        .copy((player.userData.baseScale ??= player.scale.clone()))
        .multiplyScalar(1);
    }

    const carrier = g.localColossal;
    if (carrier) {
      const model = this.object(
        "colossal:" + carrier.stage,
        () => this.colossal(carrier.stage),
        seen,
      );
      const heading = carrier.angle ?? 0;
      model.position.set(carrier.x, 0, carrier.y);
      model.rotation.y = -Math.PI / 2 - heading;
      const boarding = flight3D.colossalBoarding;
      if (boarding) {
        const forward = new T.Vector3(Math.cos(heading), 0, Math.sin(heading));
        const flank = new T.Vector3(-forward.z, 0, forward.x);
        const center = model.position;
        const entry = center.clone().addScaledVector(flank, 77);
        entry.y = 7;
        const approach = entry.clone().addScaledVector(flank, 45);
        const path = new T.CubicBezierCurve3(
          new T.Vector3(boarding.x, boarding.altitude, boarding.y),
          approach.clone().addScaledVector(forward, -70),
          approach,
          entry,
        );
        const progress = T.MathUtils.clamp(boarding.elapsed / 2.4, 0, 1);
        const t = progress * progress * (3 - 2 * progress);
        player.position.copy(path.getPoint(t));
        const direction = path.getTangent(t);
        player.rotation.set(0, Math.atan2(-direction.x, -direction.z), 0);
        player.visible = true;
        const baseScale = (player.userData.baseScale ??= player.scale.clone());
        player.scale
          .copy(baseScale)
          .multiplyScalar(
            T.MathUtils.lerp(1, 0.25, Math.max(0, (t - 0.75) * 4)),
          );
        this.camera.position
          .copy(center)
          .addScaledVector(flank, 235)
          .addScaledVector(forward, -150);
        this.camera.position.y = 90;
        this.camera.lookAt(center.clone().lerp(player.position, 0.4));
      }
      if (pilotedCarrier) {
        const forwardX = Math.cos(heading);
        const forwardZ = Math.sin(heading);
        this.camera.position.set(
          carrier.x - forwardX * 285,
          112,
          carrier.y - forwardZ * 285,
        );
        this.camera.lookAt(
          carrier.x + forwardX * 120,
          0,
          carrier.y + forwardZ * 120,
        );
      }
      for (const part of model.children) {
        if (part.name !== "colossal-exhaust") continue;
        const length = 83 + 12 * Math.sin(now / 37 + part.position.x);
        part.visible = !!pilotedCarrier && thrust && !g.paused && !g.panel;
        part.scale.y = length;
        part.position.z = 82 + length / 2;
      }
    }

    g.system.planets.forEach((planet, index) => {
      const pos = planetPosition(index);
      const mesh = this.object(
        planet.id,
        () =>
          new T.Mesh(
            this.sphere,
            this.material(
              0xe6d9cf,
              "planet",
              17 + (planet.seed % 4),
              planet.kind,
            ),
          ),
        seen,
      );
      const radius = 57 + (index % 3) * 8;
      mesh.scale.setScalar(radius);
      mesh.position.set(pos.x, spaceAltitude("planet", planet.id), pos.y);
    });
    for (const star of g.system.stars) {
      const data = starClasses[star.kind];
      const mesh = this.object(
        star.id,
        () =>
          new T.Mesh(
            this.sphere,
            this.material(Number.parseInt(data.color.slice(1), 16), "star"),
          ),
        seen,
      );
      mesh.scale.setScalar(data.radius);
      mesh.position.set(star.x, spaceAltitude("star", star.id), star.y);
    }
    for (const asteroid of g.asteroids) {
      const mesh = this.object(
        asteroid.id,
        () =>
          new T.Mesh(
            this.rock,
            this.material(0xb2a399, "rock", Math.floor(asteroid.x) % 4),
          ),
        seen,
      );
      mesh.position.set(
        asteroid.x,
        spaceAltitude("asteroid", asteroid.id),
        asteroid.y,
      );
      mesh.scale.set(asteroid.r, asteroid.r * 0.78, asteroid.r * 1.13);
      mesh.rotation.y = (asteroid.x % 6) + performance.now() / 13000;
    }
    const station = g.system.station;
    if (station) {
      const model = this.object(
        station.id,
        () => this.station(station.kind === "clandestine"),
        seen,
      );
      model.position.set(station.x, 0, station.y);
    }
    for (const npc of g.radarShips) {
      const model = this.object(
        "npc:" + npc.id,
        () =>
          this.ship(
            npc.role === "ally" ? 0x4bb99e : npc.engaged ? 0xbf6258 : 0xa89978,
          ),
        seen,
      );
      const dx = npc.x - model.position.x;
      const dz = npc.y - model.position.z;
      const following = npc.role === "ally" || npc.engaged;
      const targetHeight = following
        ? altitude + (npc.role === "ally" ? 12 : 0)
        : 0;
      const climb = g.paused
        ? 0
        : T.MathUtils.clamp(
            (targetHeight - model.position.y) * dt * 2.6,
            -160 * dt,
            160 * dt,
          );
      const planarSpeed = Math.hypot(dx, dz) > 0.02 ? 85 : 25;
      const bank = Math.atan2(climb, Math.max(0.01, dt) * planarSpeed);
      model.rotation.set(
        T.MathUtils.lerp(model.rotation.x, bank, 1 - Math.exp(-8 * dt)),
        Math.hypot(dx, dz) > 0.02 ? Math.atan2(-dx, -dz) : model.rotation.y,
        0,
        "YXZ",
      );
      model.position.set(npc.x, model.position.y + climb, npc.y);
      model.scale.setScalar(0.7);
    }
    flight3D.bolts.forEach((bolt, index) => {
      const color = bolt.hostile ? 0xff8874 : (bolt.color ?? 0xe0f8be);
      const mesh = this.object(
        "bolt:" + index,
        () => new T.Mesh(this.laser, this.lightMaterial(color)),
        seen,
      ) as T.Mesh;
      mesh.material = this.lightMaterial(color);
      const direction = new T.Vector3(bolt.vx, 0, bolt.vy).normalize();
      const height = bolt.hostile ? 0 : altitude;
      mesh.position.set(
        bolt.x - direction.x * 5,
        height,
        bolt.y - direction.z * 5,
      );
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
      mesh.scale.set(1.4, 14, 1.4);
    });
    const beam = flight3D.beam;
    if (beam) {
      const mesh = this.object(
        "mining-beam",
        () => new T.Mesh(this.laser, this.lightMaterial(0x76ffdb)),
        seen,
      );
      const direction = new T.Vector3(
        beam.tx - beam.x,
        (beam.targetAltitude ?? 0) - altitude,
        beam.ty - beam.y,
      );
      const length = direction.length();
      mesh.position.set(
        (beam.x + beam.tx) / 2,
        (altitude + (beam.targetAltitude ?? 0)) / 2,
        (beam.y + beam.ty) / 2,
      );
      mesh.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        direction.normalize(),
      );
      mesh.scale.set(1.25, length, 1.25);
    }
    for (const [id, object] of this.objects)
      if (!seen.has(id)) {
        this.scene.remove(object);
        this.objects.delete(id);
      }
    this.renderer.render(this.scene, this.camera);
  }

  private disposeMap(model: T.Object3D) {
    model.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      for (const material of materials) material.dispose();
    });
  }

  destroy() {
    this.disposed = true;
    if (this.mapModel) this.disposeMap(this.mapModel);
    for (const geometry of [
      this.sphere,
      this.rock,
      this.box,
      this.nozzle,
      this.flame,
      this.laser,
      ...this.profiles.values(),
    ])
      geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const object of this.scene.children)
      if (object instanceof T.Points) {
        object.geometry.dispose();
        object.material.dispose();
      }
    for (const texture of this.textures.values()) texture.dispose();
    this.stationFloor.dispose();
    this.jumpTrails?.dispose();
    this.surfaceCinematic?.terrain.dispose();
    this.renderer.dispose();
  }
}
