import { expect, it, vi } from "vitest";
import { emptySettlement, placePiece } from "../construction/building";
import {
  advanceElevatorRide, elevatorDeck, elevatorFloor, elevatorPowerSources, elevatorStop, elevatorStops, powerElevator,
} from "../construction/elevator";
import { advancePowerNetwork, PLANET_DAY, powerNetwork } from "../construction/habitat";
import { Terrain, WATER_TILE } from "../game/procedural/terrain";
import type { Save } from "../game/types";
import { systemAt } from "../universe/generator";

function shaft() {
  const planet = systemAt("VOIDBOUND", 0, 0).planets[0]!;
  const terrain = new Terrain(planet, {});
  vi.spyOn(terrain, "getAt").mockImplementation((x, y) =>
    y >= 30 && (x !== 8 || y >= 50) ? 1 : 0);
  const settlement = emptySettlement();
  const player: Save["player"] = { x: 136, y: 448, surfaceZ: 48, health: 100, oxygen: 100, energy: 100, hunger: 100 };
  const ctx = { terrain, settlement, player, inventory: { modularElevator: 3 }, landingX: 1, depth: 3, capacity: 40 };
  for (const row of [29, 38, 48]) {
    player.y = elevatorDeck(row) - 12;
    expect(placePiece(ctx, "modularElevator", 8, row)).toBeUndefined();
  }
  return { terrain, settlement, player, origin: elevatorStop(settlement, "8,29,3")! };
}

it("liga paradas alinhadas na superfície e no poço, bloqueando passagens com paredes ou líquido", () => {
  const { terrain, settlement, origin } = shaft();
  settlement.pieces["8,40,4"] = { kind: "modularElevator", facing: 1 };
  expect(elevatorStops(terrain, settlement, origin).map(stop => stop.y)).toEqual([38, 48]);
  settlement.depthBlocks = { "8,43,3": true };
  expect(elevatorStops(terrain, settlement, origin).map(stop => stop.y)).toEqual([38]);
  const getAt = vi.mocked(terrain.getAt).getMockImplementation()!;
  vi.mocked(terrain.getAt).mockImplementation((x, y, z) => x === 8 && y === 34 && z === 3
    ? WATER_TILE : getAt(x, y, z));
  expect(elevatorStops(terrain, settlement, origin)).toEqual([]);
});

it("usa sol direto ou energia armazenada na bateria e recusa partidas sem carga", () => {
  const { terrain, settlement, origin } = shaft();
  const stops = [origin, ...elevatorStops(terrain, settlement, origin)];
  settlement.pieces["9,29,3"] = { kind: "solarPanel", facing: 1 };
  expect(powerElevator(terrain, settlement, stops, 0, 304)).toBe(true);
  settlement.pieces["9,27,3"] = { kind: "woodBlock", facing: 1 };
  expect(powerElevator(terrain, settlement, stops, 0, 304)).toBe(false);
  expect(elevatorPowerSources(terrain, settlement, stops)).toMatchObject({ panels: 0, batteries: [] });
  delete settlement.pieces["9,27,3"];
  expect(powerElevator(terrain, settlement, stops, PLANET_DAY / 2, 304)).toBe(false);
  settlement.pieces["10,29,3"] = { kind: "battery", facing: 1, energy: 0 };
  advancePowerNetwork(settlement, powerNetwork(terrain, settlement), 0, 5);
  const battery = settlement.pieces["10,29,3"];
  const charge = battery.energy!;
  settlement.pieces["28,29,3"] = { kind: "battery", facing: 1, energy: 100 };
  expect(elevatorPowerSources(terrain, settlement, stops)).toEqual({
    panels: 1, batteries: [{ key: "10,29,3", charge }], capacity: 1200, charge,
  });
  expect(powerElevator(terrain, settlement, stops, PLANET_DAY / 2, 304)).toBe(true);
  expect(battery.energy).toBeCloseTo(charge - 19);
  expect(powerElevator(terrain, settlement, stops, PLANET_DAY / 2, 48 * 16)).toBe(false);
  expect(battery.energy).toBeCloseTo(charge - 19);
});

it("transporta o jogador por paradas intermediárias e permite ficar sobre a plataforma na chegada", () => {
  const { terrain, settlement, player, origin } = shaft();
  player.y = elevatorDeck(origin.y) - 12;
  player.elevatorRide = { planetId: terrain.planet.id, origin: origin.key, destination: "8,48,3" };
  for (let i = 0; i < 500 && player.elevatorRide; i++)
    expect(advanceElevatorRide(player, terrain, settlement, 1 / 60, true)).toBe(true);
  expect(player.elevatorRide).toBeUndefined();
  expect(player.y).toBe(elevatorDeck(48) - 12);
  expect(elevatorFloor(settlement, player.x, 48, player.y + 12, player.y + 13)).toBe(elevatorDeck(48));
  expect(elevatorFloor(settlement, player.x + 16, 48, player.y + 12, player.y + 13)).toBeUndefined();
});
