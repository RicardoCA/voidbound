import { reportCrime, wantedStatus } from "./law";
import type { Save, StarSystem } from "../game/types";
import {
  enforcementNpc,
  hitNpc,
  trafficFor,
  type Point,
  type SpaceNpc,
} from "./traffic";

export interface Bolt extends Point {
  vx: number;
  vy: number;
  life: number;
  hostile: boolean;
  damage: number;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function launch(
  source: Point,
  aim: Point,
  speed: number,
  damage: number,
  hostile: boolean,
): Bolt {
  const angle = Math.atan2(aim.y - source.y, aim.x - source.x);
  return {
    x: source.x,
    y: source.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.85,
    hostile,
    damage,
  };
}

export class SpaceCombat {
  npcs: SpaceNpc[] = [];
  bolts: Bolt[] = [];
  private nextShot = 0;

  reset(state: Save, system: StarSystem) {
    this.npcs = trafficFor(system, state.progression.piracy);
    this.bolts = [];
    this.nextShot = 0;
  }

  private updateEnforcement(
    state: Save,
    system: StarSystem,
    level: number,
    security: number,
  ) {
    const ship = state.ship;
    const reinforcements = [
      {
        role: "police",
        enabled: security >= 2 || level >= 2,
        home:
          level >= 2 ? { x: ship.x + 295, y: ship.y - 95 } : { x: 755, y: 60 },
      },
      {
        role: "bounty",
        enabled: level >= 4,
        home: { x: ship.x - 275, y: ship.y + 95 },
      },
      {
        role: "elite",
        enabled: level >= 5,
        home: { x: ship.x + 60, y: ship.y + 325 },
      },
    ] as const;
    for (const reinforcement of reinforcements) {
      if (
        !reinforcement.enabled ||
        this.npcs.some((npc) => npc.role === reinforcement.role)
      )
        continue;
      const npc = enforcementNpc(
        system,
        state.progression.piracy,
        reinforcement.role,
        reinforcement.home,
      );
      if (npc) this.npcs.push(npc);
    }
  }

  target(ship: Point, range: number) {
    let nearest: SpaceNpc | undefined;
    for (const npc of this.npcs) {
      if (npc.hull <= 0) continue;
      const separation = distance(ship, npc);
      if (separation < range) {
        nearest = npc;
        range = separation;
      }
    }
    return nearest;
  }

  fire(state: Save) {
    const ship = state.ship;
    if (state.time < this.nextShot || ship.energy < 4) return false;
    const target = this.target(ship, 340);
    const flightTime = target ? distance(ship, target) / 560 : 0;
    const aim = target
      ? {
          x: target.x + target.vx * flightTime,
          y: target.y + target.vy * flightTime,
        }
      : { x: ship.x + Math.cos(ship.angle), y: ship.y + Math.sin(ship.angle) };
    this.bolts.push(launch(ship, aim, 560, 15, false));
    this.nextShot = state.time + 0.23;
    ship.energy -= 4;
    return true;
  }

  update(state: Save, system: StarSystem, dt: number) {
    const ship = state.ship;
    const { level, security } = wantedStatus(state, system);
    this.updateEnforcement(state, system, level, security);
    let crimeReported = false;
    let destroyed = false,
      playerDisabled = false;
    const threatened = this.npcs.some(
      (npc) =>
        npc.role === "freighter" && npc.engaged && distance(npc, ship) < 530,
    );
    for (const npc of this.npcs) {
      if (npc.hull <= 0 || distance(ship, npc) > 800) continue;
      const separation = distance(ship, npc);
      const police = npc.role === "police" || npc.role === "elite";
      const bounty = npc.role === "bounty";
      const armed =
        npc.role === "escort" || npc.role === "pirate" || police || bounty;
      const chasing =
        armed &&
        (npc.engaged ||
          (police
            ? level >= 2 && separation < 600
            : bounty
              ? level >= 4 && separation < 650
              : npc.role === "pirate"
                ? separation < 220
                : threatened));
      const fleeing =
        !armed &&
        npc.engaged &&
        separation < 500 &&
        distance(npc, npc.home) < 420;
      const phase = state.time * 0.22;
      const aim = chasing
        ? ship
        : fleeing
          ? { x: npc.x * 2 - ship.x, y: npc.y * 2 - ship.y }
          : {
              x: npc.home.x + Math.cos(phase) * 55,
              y: npc.home.y + Math.sin(phase) * 29,
            };
      const dx = aim.x - npc.x,
        dy = aim.y - npc.y;
      const length = Math.hypot(dx, dy);
      const speed = chasing
        ? separation > 135
          ? 73
          : 12
        : fleeing
          ? 48
          : Math.min(21, length);
      npc.angle = Math.atan2(dy, dx);
      npc.vx = Math.cos(npc.angle) * speed;
      npc.vy = Math.sin(npc.angle) * speed;
      npc.x += npc.vx * dt;
      npc.y += npc.vy * dt;
      if (chasing && separation < 260 && state.time >= npc.fireAt) {
        const travel = separation / 315;
        this.bolts.push(
          launch(
            npc,
            { x: ship.x + ship.vx * travel, y: ship.y + ship.vy * travel },
            315,
            npc.role === "elite" ? 9 : bounty ? 7 : 5,
            true,
          ),
        );
        npc.fireAt = state.time + 1.1;
      }
    }
    for (const bolt of this.bolts) {
      bolt.life -= dt;
      if (bolt.life <= 0) continue;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.hostile) {
        if (distance(bolt, ship) > 15) continue;
        bolt.life = 0;
        ship.hull -=
          bolt.damage * (state.upgrades.includes("shield") ? 0.5 : 1);
        if (ship.hull <= 0) {
          ship.hull = 30;
          ship.fuel = Math.max(ship.fuel, 15);
          ship.vx = 0;
          ship.vy = 0;
          playerDisabled = true;
          for (const npc of this.npcs) npc.engaged = false;
          break;
        }
      } else {
        const target = this.target(bolt, 16);
        if (!target) continue;
        bolt.life = 0;
        const authorityTarget =
          target.role === "police" || target.role === "elite";
        const witnessed = this.npcs.some(
          (other) =>
            other.id !== target.id &&
            other.hull > 0 &&
            other.role !== "pirate" &&
            distance(target, other) < 310,
        );
        if (target.role !== "pirate" && !target.assaultReported) {
          target.assaultReported = true;
          crimeReported =
            reportCrime(
              state,
              system,
              target.name,
              "assault",
              witnessed,
              authorityTarget,
            ) || crimeReported;
        }
        if (hitNpc(state, system, target, bolt.damage)) {
          destroyed = true;
          if (target.role !== "pirate")
            crimeReported =
              reportCrime(
                state,
                system,
                target.name,
                "destruction",
                witnessed,
                authorityTarget,
              ) || crimeReported;
        }
      }
    }
    this.bolts = playerDisabled
      ? []
      : this.bolts.filter((bolt) => bolt.life > 0);
    return { destroyed, playerDisabled, crimeReported };
  }
}
