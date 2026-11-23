import { daylight } from "../construction/habitat";
import { footprint } from "../construction/pieces";
import { stepSurface, type Actor } from "../game/physics/surface";
import { solidSurfaceVoxel, stepSurfaceDepth, surfaceLayer, surfaceWallBlocks, surfaceWallPenetration } from "../game/physics/surfaceDepth";
import { hash } from "../game/procedural/random";
import { TILE, isLiquidTile, isSolidTile, type Terrain } from "../game/procedural/terrain";
import type { Settlement } from "../game/types";

type Player = { x: number; y: number; health: number; surfaceZ?: number };
export interface NightMonster extends Actor {
  id: string;
  variant: number;
  z: number;
  yaw: number;
  health: number;
  stride: number;
  chasing: boolean;
  nextSight: number;
  nextAttack: number;
  stuck: boolean;
}

interface Plot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function protectedMonsterPlots(data: Settlement, spatial: boolean) {
  const columns = new Map<string, [number, number]>();
  const add = (x: number, z: number) => {
    if (spatial || z === 0) columns.set(`${x},${z}`, [x, z]);
  };
  for (const [key, piece] of Object.entries(data.pieces)) {
    const [x = 0, y = 0, z = 0] = key.split(",").map(Number);
    for (const cell of footprint(piece.kind, x, y)) add(cell.x, z);
  }
  for (const entries of [data.walls, data.depthWalls, data.cornerWalls, data.depthBlocks, data.crops])
    for (const key of Object.keys(entries ?? {})) {
      const [x = 0, , z = 0] = key.split(",").map(Number);
      add(x, z);
    }

  const plots: Plot[] = [];
  const reach = spatial ? 1 : 6;
  for (const [key, [x, z]] of columns) {
    columns.delete(key);
    const plot = { minX: x, maxX: x, minZ: z, maxZ: z };
    const connected: [number, number][] = [[x, z]];
    for (const [cx, cz] of connected) {
      plot.minX = Math.min(plot.minX, cx);
      plot.maxX = Math.max(plot.maxX, cx);
      plot.minZ = Math.min(plot.minZ, cz);
      plot.maxZ = Math.max(plot.maxZ, cz);
      for (let dx = -reach; dx <= reach; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const neighbor = `${cx + dx},${cz + dz}`;
          const found = columns.get(neighbor);
          if (found) {
            columns.delete(neighbor);
            connected.push(found);
          }
        }
    }
    plots.push(plot);
  }
  return plots;
}

export function monsterCanSpawn(terrain: Terrain, data: Settlement, plots: readonly Plot[], x: number, z: number) {
  if (plots.some(plot => x >= plot.minX - 1 && x <= plot.maxX + 1 &&
      z >= plot.minZ - 1 && z <= plot.maxZ + 1)) return false;
  if (Math.abs(z) <= 6 && [0, 24, 48].some(pad => Math.abs(x - pad) <= 7)) return false;
  const ground = terrain.heightAt(x, z);
  if (!isSolidTile(terrain.getAt(x, ground, z))) return false;
  // Also reject overhangs and roofs that shield a column from the sky.
  for (let row = 0; row < ground; row++) {
    if (terrain.getAt(x, row, z) !== 0 || solidSurfaceVoxel(terrain, data, x, row, z))
      return false;
  }
  return true;
}

function sees(terrain: Terrain, data: Settlement, from: NightMonster, player: Player) {
  const dx = player.x - from.x;
  const dy = player.y - from.y;
  const dz = (player.surfaceZ ?? 0) - from.z;
  const steps = Math.ceil(Math.hypot(dx, dy, dz) / 4);
  for (let step = 1; step < steps; step++) {
    const scale = step / steps;
    const x = from.x + scale * dx, y = from.y + scale * dy, z = from.z + scale * dz;
    if (solidSurfaceVoxel(terrain, data, Math.floor(x / TILE), Math.floor(y / TILE), surfaceLayer(z)) ||
        surfaceWallBlocks(data, x, y, z))
      return false;
  }
  return true;
}

const approachRange = 144;

export class NightMonsters {
  readonly actors = new Map<string, NightMonster>();
  private nextSpawn = 0;
  private serial = 0;

  reset() {
    this.actors.clear();
    this.nextSpawn = 0;
    this.serial = 0;
  }

  strike(id: string, player: Player, terrain: Terrain, settlement: Settlement, saber: boolean) {
    const actor = this.actors.get(id);
    if (!saber || !actor ||
        Math.hypot(actor.x - player.x, actor.y - player.y, actor.z - (player.surfaceZ ?? 0)) > 77 ||
        !sees(terrain, settlement, actor, player)) return false;
    actor.health -= 2;
    if (actor.health <= 0) this.actors.delete(id);
    return true;
  }

  private spawn(terrain: Terrain, data: Settlement, player: Player, time: number, spatial: boolean) {
    const plots = protectedMonsterPlots(data, spatial);
    const id = `zumbi:${++this.serial}`;
    const seed = hash(`${terrain.planet.seed}:${id}`);
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = (seed % 628) / 100 + attempt * 2.4;
      const radius = 100 + (hash(`${seed}:${attempt}`) % 100);
      const x = Math.floor((player.x + Math.cos(angle) * radius) / TILE);
      const z = spatial ? surfaceLayer((player.surfaceZ ?? 0) + Math.sin(angle) * radius) : 0;
      if (!monsterCanSpawn(terrain, data, plots, x, z)) continue;
      const y = terrain.heightAt(x, z) * TILE - 12;
      const wx = (x + .5) * TILE;
      if (Math.abs(y - player.y) > 57 ||
          Math.hypot(wx - player.x, z * TILE - (player.surfaceZ ?? 0)) < 96 ||
          [...this.actors.values()].some(other => Math.hypot(other.x - wx, other.z - z * TILE) < 28)) continue;
      this.actors.set(id, {
        id, variant: seed % 5, x: wx, y, z: z * TILE, yaw: 0, vy: 0,
        grounded: true, health: 4, stride: 0, chasing: false, nextSight: time,
        nextAttack: time + 1, stuck: false,
      });
      return;
    }
  }

  update(terrain: Terrain, settlement: Settlement, player: Player, time: number, dt: number, spatial: boolean) {
    if (daylight(time) > 0) {
      if (this.actors.size || this.nextSpawn) this.reset();
      return;
    }
    if (this.actors.size < 4 && time >= this.nextSpawn) {
      this.spawn(terrain, settlement, player, time, spatial);
      this.nextSpawn = time + 4;
    }
    for (const [id, actor] of this.actors) {
      const dx = player.x - actor.x, dz = (player.surfaceZ ?? 0) - actor.z;
      if (Math.abs(dz) > 230 || Math.abs(dx) > 230 || actor.y > 990 ||
          isLiquidTile(terrain.getAt(Math.floor(actor.x / TILE), Math.floor(actor.y / TILE), surfaceLayer(actor.z)))) {
        this.actors.delete(id);
        continue;
      }
      const horizontal = Math.hypot(dx, dz);
      const distance = Math.hypot(horizontal, player.y - actor.y);
      if (time >= actor.nextSight) {
        actor.chasing = distance < approachRange && sees(terrain, settlement, actor, player);
        actor.nextSight = time + .22;
      }
      const stride = actor.chasing && horizontal > 12 ? Math.min(40 * dt, horizontal) : 0;
      const moveX = stride ? dx / horizontal * stride : 0;
      const moveZ = stride ? dz / horizontal * stride : 0;
      if (stride) actor.yaw = Math.atan2(-dx, -dz);
      const jump = actor.chasing && actor.stuck && actor.grounded && player.y < actor.y - 8;
      const penetration = spatial ? surfaceWallPenetration(settlement, actor.x, actor.y, actor.z) : 0;
      const next = spatial
        ? stepSurfaceDepth(actor, moveX, moveZ, jump, terrain.planet.gravity, dt,
            (x, y, z) => solidSurfaceVoxel(terrain, settlement, x, y, z),
            (x, y, z) => surfaceWallPenetration(settlement, x, y, z) > penetration)
        : stepSurface(actor, stride ? Math.sign(dx) * (40 / 90) : 0, jump,
            terrain.planet.gravity, dt, terrain, settlement);
      const traveled = Math.hypot(next.x - actor.x, ("z" in next ? Number(next.z) : 0) - actor.z);
      Object.assign(actor, next);
      actor.stride += traveled * .24;
      actor.stuck = stride > 0 && traveled < .03;
      if (actor.chasing && distance < 24 && time >= actor.nextAttack && sees(terrain, settlement, actor, player)) {
        player.health = Math.max(0, player.health - 12);
        actor.nextAttack = time + 1.25;
      }
    }
  }
}
