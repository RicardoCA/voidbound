import { connectedPowerSources, daylight, SOLAR_RATE, spendBatteryCharge, sunlightBetween } from "./habitat";
import { keyAt, pieceAt } from "./pieces";
import { surfaceWallPenetration } from "../game/physics/surfaceDepth";
import { TILE, type Terrain } from "../game/procedural/terrain";
import type { Save, Settlement } from "../game/types";

export interface ElevatorStop {
  key: string;
  x: number;
  y: number;
  depth: number;
}

export const ELEVATOR_SPEED = 48;
export const elevatorDeck = (row: number) => (row + 1) * TILE - 2;

export function elevatorStop(data: Settlement, key: string): ElevatorStop | undefined {
  if (data.pieces[key]?.kind !== "modularElevator") return;
  const [x = 0, y = 0, depth = 0] = key.split(",").map(Number);
  return { key, x, y, depth };
}

export function clearElevatorShaft(terrain: Terrain, data: Settlement, stop: ElevatorStop, endRow: number) {
  const { x, y, depth } = stop;
  if (!Number.isInteger(endRow) || endRow < 2 || endRow >= 63) return false;
  for (let row = Math.min(y, endRow) - 1; row <= Math.max(y, endRow); row++) {
    const key = keyAt(x, row, depth);
    const piece = pieceAt(data, x, row, depth)?.piece;
    if (terrain.getAt(x, row, depth) !== 0 || data.depthBlocks?.[key] || data.crops?.[key] ||
        (piece && piece.kind !== "modularElevator" && !(piece.kind === "woodHatch" && piece.open)) ||
        surfaceWallPenetration(data, x * TILE + TILE / 2, row * TILE + TILE / 2, depth * TILE) > 0)
      return false;
  }
  return true;
}

export function elevatorStops(terrain: Terrain, data: Settlement, origin: ElevatorStop) {
  const stops: ElevatorStop[] = [];
  for (let y = 2; y < 63; y++) {
    const stop = elevatorStop(data, keyAt(origin.x, y, origin.depth));
    if (stop && y !== origin.y && Math.abs(y - origin.y) >= 2 &&
        clearElevatorShaft(terrain, data, origin, y)) stops.push(stop);
  }
  return stops;
}

export function elevatorPowerSources(terrain: Terrain, data: Settlement, stops: readonly ElevatorStop[]) {
  return connectedPowerSources(terrain, data, stops);
}

export function powerElevator(terrain: Terrain, data: Settlement, stops: readonly ElevatorStop[], time: number, distance: number) {
  const { panels, batteries, charge } = elevatorPowerSources(terrain, data, stops);
  // A trip reserves its energy before leaving so a sunset cannot strand the rider.
  const duration = distance / ELEVATOR_SPEED;
  const solar = daylight(time) > 0 && daylight(time + duration) > 0
    ? panels * SOLAR_RATE * sunlightBetween(time, time + duration)
    : 0;
  const demand = Math.max(0, Math.ceil(distance / TILE) - solar);
  if (!demand) return true;

  return spendBatteryCharge(data, { batteries, charge }, demand);
}

export function elevatorFloor(data: Settlement, x: number, z: number, previousFeet: number, feet: number) {
  const column = Math.floor(x / TILE);
  const depth = Math.round(z / TILE);
  if (Math.abs(z - depth * TILE) > 8) return;
  for (let row = Math.ceil((previousFeet + 2) / TILE) - 1; elevatorDeck(row) <= feet; row++) {
    if (elevatorStop(data, keyAt(column, row, depth))) return elevatorDeck(row);
  }
}

export function advanceElevatorRide(
  player: Save["player"],
  terrain: Terrain,
  data: Settlement,
  dt: number,
  spatial: boolean,
) {
  const ride = player.elevatorRide;
  if (!ride) return false;
  const origin = elevatorStop(data, ride.origin);
  const target = elevatorStop(data, ride.destination);
  if (ride.planetId !== terrain.planet.id || !origin || !target ||
      target.x !== origin.x || target.depth !== origin.depth || (!spatial && origin.depth)) {
    delete player.elevatorRide;
    return false;
  }
  const y = elevatorDeck(target.y) - 12;
  const next = player.y + Math.sign(y - player.y) * Math.min(Math.abs(y - player.y), ELEVATOR_SPEED * dt);
  const first = Math.floor((next - 12) / TILE) + 1;
  const last = Math.floor((next + 12) / TILE);
  if (!clearElevatorShaft(terrain, data, { ...origin, y: first }, last)) {
    delete player.elevatorRide;
    return false;
  }
  player.x = target.x * TILE + TILE / 2;
  player.surfaceZ = target.depth * TILE;
  player.y = next;
  if (next === y) delete player.elevatorRide;
  return true;
}
