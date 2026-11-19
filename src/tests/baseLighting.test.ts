import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { PointLight, SpotLight, Texture, TextureLoader } from "three";
import {
  emptySettlement,
  placePiece,
  removePiece,
} from "../construction/building";
import { powerNetwork, advancePowerNetwork } from "../construction/habitat";
import { EMERGENCY_CAPACITY } from "../construction/lighting";
import { Terrain } from "../game/procedural/terrain";
import { systemAt } from "../universe/generator";
import {
  SurfaceWorld3D,
  type SurfaceFrame,
} from "../game/rendering/SurfaceWorld3D";
import { useGame } from "../stores/game";
import { migrateSave } from "../persistence/migrations";
const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const terrain = new Terrain(planet, {}),
    data = emptySettlement();
  vi.spyOn(terrain, "getAt").mockReturnValue(0);
  return { terrain, data };
}
describe("rede de iluminação da base", () => {
  it("alimenta o holofote à noite pela bateria e desliga quando acaba", () => {
    const { terrain, data } = fixture();
    data.pieces["0,28"] = { kind: "battery", facing: 1, energy: 10 };
    data.pieces["2,28"] = { kind: "floodlight", facing: 1, rotation: 0 };
    const network = powerNetwork(terrain, data);
    advancePowerNetwork(data, network, 450, 451);
    expect(data.pieces["0,28"]!.energy).toBe(8);
    expect(data.pieces["2,28"]!.powered).toBe(true);
    advancePowerNetwork(data, network, 451, 456);
    expect(data.pieces["0,28"]!.energy).toBe(0);
    expect(data.pieces["2,28"]!.powered).toBe(false);
  });
  it("compartilha a energia sem duplicá-la entre holofotes", () => {
    const { terrain, data } = fixture();
    data.pieces["0,28"] = { kind: "battery", facing: 1, energy: 3 };
    for (const x of [1, 2])
      data.pieces[`${x},28`] = { kind: "floodlight", facing: 1 };
    advancePowerNetwork(data, powerNetwork(terrain, data), 450, 451);
    expect(data.pieces["0,28"]!.energy).toBe(0);
    expect([1, 2].filter((x) => data.pieces[`${x},28`]!.powered)).toHaveLength(
      0,
    );
  });
  it("usa energia solar direta e respeita alcance e noite", () => {
    const { terrain, data } = fixture();
    data.pieces["0,28"] = { kind: "solarPanel", facing: 1 };
    data.pieces["2,28"] = { kind: "floodlight", facing: 1 };
    data.pieces["20,28"] = { kind: "floodlight", facing: 1 };
    const network = powerNetwork(terrain, data);
    advancePowerNetwork(data, network, 0, 1);
    expect(data.pieces["2,28"]!.powered).toBe(true);
    expect(data.pieces["20,28"]!.powered).toBe(false);
    advancePowerNetwork(data, network, 450, 451);
    expect(data.pieces["2,28"]!.powered).toBe(false);
  });
  it("carrega a reserva e acende automaticamente na queda de energia, até esgotar", () => {
    const { terrain, data } = fixture();
    data.pieces["0,28"] = { kind: "solarPanel", facing: 1 };
    data.pieces["2,28"] = {
      kind: "emergencyLight",
      facing: 1,
      backupEnergy: 0,
    };
    const network = powerNetwork(terrain, data),
      lamp = data.pieces["2,28"]!;
    advancePowerNetwork(data, network, 0, 120);
    expect(lamp.backupEnergy).toBe(EMERGENCY_CAPACITY);
    expect(lamp.powered).toBe(true);
    expect(lamp.emergencyActive).toBe(false);
    advancePowerNetwork(data, network, 450, 451);
    expect(lamp.powered).toBe(false);
    expect(lamp.emergencyActive).toBe(true);
    expect(lamp.backupEnergy).toBeCloseTo(119.9);
    delete data.pieces["0,28"];
    advancePowerNetwork(data, powerNetwork(terrain, data), 451, 1652);
    expect(lamp.backupEnergy).toBe(0);
    expect(lamp.emergencyActive).toBe(false);
  });
  it("não cria carga inicial e mantém o estado no save", () => {
    const { terrain, data } = fixture();
    data.pieces["0,29,3"] = { kind: "woodBlock", facing: 1 };
    const ctx = {
      terrain,
      settlement: data,
      inventory: { emergencyLight: 1 },
      capacity: 24,
      player: { x: -25, y: 456, surfaceZ: 48 },
      depth: 3,
      rotation: 1,
      landingX: 100,
    };
    expect(placePiece(ctx, "emergencyLight", 0, 28)).toBeUndefined();
    expect(data.pieces["0,28,3"]!.backupEnergy).toBe(0);
    data.pieces["0,28,3"]!.backupEnergy = 42;
    setActivePinia(createPinia());
    const g = useGame();
    g.state.settlements[g.planet.id] = data;
    expect(
      migrateSave(JSON.parse(JSON.stringify(g.state))).settlements[g.planet.id],
    ).toEqual(data);
    expect(removePiece(ctx, 0, 28)).toBeUndefined();
    expect(ctx.inventory.emergencyLight).toBe(1);
    expect(placePiece(ctx, "emergencyLight", 0, 28)).toBeUndefined();
    expect(data.pieces["0,28,3"]!.backupEnergy).toBe(0);
  });
});
it("projeta luz real e gira o feixe; reserva de emergência produz luz verde", () => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
  const { terrain, data } = fixture(),
    world = new SurfaceWorld3D();
  data.pieces["0,28,3"] = {
    kind: "floodlight",
    facing: 1,
    powered: true,
    rotation: 1,
  };
  data.pieces["2,28,3"] = {
    kind: "emergencyLight",
    facing: 1,
    emergencyActive: true,
    backupEnergy: 120,
  };
  const frame: SurfaceFrame = {
    terrain,
    settlement: data,
    camera: { x: 8, y: 450, z: 48, yaw: 0, pitch: 0 },
    revision: 0,
    light: 0,
    elapsed: 0,
    sunPhase: Math.PI,
    facing: 1,
    stride: 0,
    animals: [],
    fruit: [],
    drops: [],
  };
  try {
    world.update(frame, 960, 540);
    const spots: SpotLight[] = [],
      exits: PointLight[] = [];
    world.scene.traverse((object) => {
      if (object instanceof SpotLight && object.intensity > 0)
        spots.push(object);
      if (object instanceof PointLight && object.intensity > 0)
        exits.push(object);
    });
    expect(spots).toHaveLength(1);
    expect(exits).toHaveLength(1);
    expect(spots[0]!.target.position.x).toBeGreaterThan(spots[0]!.position.x);
    expect(spots[0]!.target.position.y).toBeLessThan(spots[0]!.position.y);
    data.pieces["0,28,3"]!.powered = false;
    data.pieces["2,28,3"]!.emergencyActive = false;
    world.update({ ...frame, revision: 1 }, 960, 540);
    expect(spots[0]!.intensity).toBe(0);
    expect(exits[0]!.intensity).toBe(0);
  } finally {
    world.dispose();
  }
});
