import {
  escortTiers,
  REPAIR_DURATION,
  type EscortContract,
} from "../fleet/escorts";
import { bountyTargets } from "../progression/contracts";
import { selectedWeapon, shipWeapons } from "./weapons";
import { reportCrime, surrenderToPolice, wantedStatus } from "./law";
import type { Save, StarSystem } from "../game/types";
import {
  damageNpcHull,
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
  color?: number;
  shieldMultiplier?: number;
  escortTarget?: string;
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

interface EscortFlight extends Point {
  pilot: EscortContract;
  angle: number;
  fireAt: number;
}

export interface PoliceContact {
  officerId: string;
  name: string;
  phase: "scan" | "offer" | "combat";
  progress: number;
}

const SCAN_RANGE = 225;
const SCAN_DURATION = 3;
const isPolice = (npc: SpaceNpc) =>
  npc.role === "police" || npc.role === "elite";

export class SpaceCombat {
  escorts: EscortFlight[] = [];
  policeContact?: PoliceContact;
  private nextInspection = 0;

  clearPoliceContact() {
    this.policeContact = undefined;
    this.nextInspection = 0;
  }

  answerPolice(state: Save, system: StarSystem, surrender: boolean) {
    if (this.policeContact?.phase !== "offer") return;
    if (!surrender) {
      this.policeContact = { ...this.policeContact, phase: "combat" };
      return "Rendição recusada. A patrulha abriu combate.";
    }
    this.policeContact = undefined;
    this.nextInspection = state.time + 60;
    state.ship.vx = 0;
    state.ship.vy = 0;
    return surrenderToPolice(state, system);
  }

  private inspectPlayer(state: Save, level: number, dt: number) {
    const current = this.policeContact;
    const officer = this.npcs.find(
      (npc) => npc.id === current?.officerId && npc.hull > 0,
    );
    if (
      current &&
      (!officer ||
        distance(officer, state.ship) >
          (current.phase === "combat" ? 480 : SCAN_RANGE + 35))
    )
      this.policeContact = undefined;

    if (!this.policeContact && state.time >= this.nextInspection) {
      const nearby = this.npcs.find(
        (npc) =>
          isPolice(npc) &&
          npc.hull > 0 &&
          distance(npc, state.ship) <= SCAN_RANGE,
      );
      if (nearby)
        this.policeContact = {
          officerId: nearby.id,
          name: nearby.name,
          phase: "scan",
          progress: 0,
        };
    }
    const scan = this.policeContact;
    if (scan?.phase !== "scan") return;
    const progress = Math.min(1, scan.progress + dt / SCAN_DURATION);
    if (progress < 1) this.policeContact = { ...scan, progress };
    else if (level >= 5)
      this.policeContact = { ...scan, progress, phase: "combat" };
    else if (level || (state.inventory.sealedCargo ?? 0) > 0)
      this.policeContact = { ...scan, progress, phase: "offer" };
    else {
      this.policeContact = undefined;
      this.nextInspection = state.time + 45;
    }
  }

  npcs: SpaceNpc[] = [];
  bolts: Bolt[] = [];
  private nextShot = 0;
  private nextTrafficCheck = 0;
  private recoilUntil = new Map<string, number>();

  reset(state: Save, system: StarSystem) {
    this.npcs = trafficFor(system, state.progression.piracy, state.time);
    this.bolts = [];
    this.escorts = [];
    this.clearPoliceContact();
    this.nextShot = 0;
    this.nextTrafficCheck = 0;
    this.recoilUntil.clear();
  }

  private updateEnforcement(state: Save, system: StarSystem, level: number) {
    const reinforcements = [
      {
        role: "police",
        enabled: true,
        home: { x: -520, y: -385 },
      },
      {
        role: "bounty",
        enabled: level >= 4,
        home: { x: 680, y: -620 },
      },
      {
        role: "elite",
        enabled: level >= 5,
        home: { x: -610, y: 470 },
      },
    ] as const;
    for (const reinforcement of reinforcements) {
      if (
        !reinforcement.enabled ||
        this.npcs.some((npc) => npc.role === reinforcement.role && npc.hull > 0)
      )
        continue;
      const npc = enforcementNpc(
        system,
        state.progression.piracy,
        reinforcement.role,
        reinforcement.home,
        state.time,
      );
      if (npc) this.npcs.push(npc);
    }
  }

  private updateTraffic(state: Save, system: StarSystem) {
    if (state.time < this.nextTrafficCheck) return;
    this.nextTrafficCheck = state.time + 0.25;
    this.npcs = this.npcs.filter((npc) => npc.hull > 0);
    for (const npc of trafficFor(system, state.progression.piracy, state.time))
      if (!this.npcs.some((current) => current.id === npc.id))
        this.npcs.push(npc);
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

  private boltTarget(bolt: Bolt, dx: number, dy: number) {
    const lengthSquared = dx * dx + dy * dy;
    let first: SpaceNpc | undefined;
    let firstT = Infinity;
    for (const npc of this.npcs) {
      if (npc.hull <= 0 || (bolt.escortTarget && bolt.escortTarget !== npc.id))
        continue;
      const t = lengthSquared
        ? Math.max(
            0,
            Math.min(
              1,
              ((npc.x - bolt.x) * dx + (npc.y - bolt.y) * dy) / lengthSquared,
            ),
          )
        : 0;
      if (
        t >= firstT ||
        Math.hypot(npc.x - bolt.x - t * dx, npc.y - bolt.y - t * dy) >= 16
      )
        continue;
      first = npc;
      firstT = t;
    }
    return first;
  }

  fire(state: Save) {
    const ship = state.ship;
    const weapon = shipWeapons[selectedWeapon(state)];
    if (state.time < this.nextShot || ship.energy < weapon.energy) return false;
    const target =
      this.npcs.find(
        (npc) =>
          npc.bountyTarget &&
          npc.hull > 0 &&
          distance(ship, npc) < weapon.range,
      ) ?? this.target(ship, weapon.range);
    const flightTime = target ? distance(ship, target) / weapon.speed : 0;
    const aim = target
      ? {
          x: target.x + target.vx * flightTime,
          y: target.y + target.vy * flightTime,
        }
      : { x: ship.x + Math.cos(ship.angle), y: ship.y + Math.sin(ship.angle) };
    const angle = Math.atan2(aim.y - ship.y, aim.x - ship.x);
    const color = Number.parseInt(weapon.color.slice(1), 16);
    for (const spread of weapon.angles) {
      this.bolts.push({
        x: ship.x,
        y: ship.y,
        vx: Math.cos(angle + spread) * weapon.speed,
        vy: Math.sin(angle + spread) * weapon.speed,
        life: weapon.life,
        damage: weapon.damage,
        hostile: false,
        color,
        shieldMultiplier: weapon.shieldMultiplier,
      });
    }
    this.nextShot = state.time + weapon.cooldown;
    ship.energy -= weapon.energy;
    return true;
  }

  private collide(state: Save, npc: SpaceNpc) {
    const ship = state.ship;
    const dx = npc.x - ship.x;
    const dy = npc.y - ship.y;
    const separation = Math.hypot(dx, dy);
    const bearing = separation > 0 ? Math.atan2(dy, dx) : ship.angle;
    const nx = Math.cos(bearing);
    const ny = Math.sin(bearing);
    const extent = (angle: number) =>
      Math.hypot(19 * Math.cos(bearing - angle), 9 * Math.sin(bearing - angle));
    const shipRadius = extent(ship.angle);
    const overlap = shipRadius + extent(npc.angle) - separation;
    if (overlap <= 0) return;

    const correction = (overlap + 0.5) / 2;
    ship.x -= nx * correction;
    ship.y -= ny * correction;
    npc.x += nx * correction;
    npc.y += ny * correction;
    const closing = (ship.vx - npc.vx) * nx + (ship.vy - npc.vy) * ny;
    if (closing <= 0) return;

    const impulse = closing * 0.7;
    ship.vx -= nx * impulse;
    ship.vy -= ny * impulse;
    npc.vx += nx * impulse;
    npc.vy += ny * impulse;
    if (closing < 8 || (this.recoilUntil.get(npc.id) ?? 0) > state.time) return;
    this.recoilUntil.set(npc.id, state.time + 0.45);
    return {
      x: ship.x + nx * shipRadius,
      y: ship.y + ny * shipRadius,
      damage: Math.min(45, Math.max(2, closing * 0.18)),
    };
  }

  private updateBountyTargets(state: Save, system: StarSystem) {
    const active = bountyTargets(state, system);
    this.npcs = this.npcs.filter(
      (npc) =>
        !npc.bountyTarget || active.some((target) => target.id === npc.id),
    );
    for (const target of active)
      if (!this.npcs.some((npc) => npc.id === target.id))
        this.npcs.push(target);
  }

  private flyEscorts(state: Save, dt: number) {
    const ship = state.ship;
    const active = (state.escorts ?? []).filter(
      (pilot) => pilot.remaining > 0 && !pilot.repairUntil,
    );
    this.escorts = active.map((pilot, index) => {
      const bearing = ship.angle + Math.PI + (index === 0 ? -0.65 : 0.65);
      const x = ship.x + Math.cos(bearing) * 58;
      const y = ship.y + Math.sin(bearing) * 58;
      const previous = this.escorts.find(
        (escort) => escort.pilot.id === pilot.id,
      );
      const blend = 1 - Math.exp(-dt * 5);
      return {
        pilot,
        x: previous ? previous.x + (x - previous.x) * blend : x,
        y: previous ? previous.y + (y - previous.y) * blend : y,
        angle: ship.angle,
        fireAt: previous?.fireAt ?? 0,
      };
    });
  }

  update(state: Save, system: StarSystem, dt: number) {
    const ship = state.ship;
    const { level } = wantedStatus(state, system);
    this.updateTraffic(state, system);
    this.updateEnforcement(state, system, level);
    this.updateBountyTargets(state, system);
    this.flyEscorts(state, dt);
    this.inspectPlayer(state, level, dt);
    const retreated: string[] = [];
    let crimeReported = false;
    let bountyCompleted = false;
    const impacts: Point[] = [];
    let destroyed = false,
      playerDisabled = false;
    const threatened = this.npcs.some(
      (npc) =>
        npc.role === "freighter" && npc.engaged && distance(npc, ship) < 530,
    );
    const threats: SpaceNpc[] = [];
    for (const npc of this.npcs) {
      if (npc.hull <= 0 || (!isPolice(npc) && distance(ship, npc) > 800))
        continue;
      if ((this.recoilUntil.get(npc.id) ?? 0) > state.time) {
        const drag = Math.exp(-dt * 4);
        npc.vx *= drag;
        npc.vy *= drag;
        npc.x += npc.vx * dt;
        npc.y += npc.vy * dt;
        continue;
      }
      const separation = distance(ship, npc);
      const police = isPolice(npc);
      const bounty = npc.role === "bounty";
      const armed =
        npc.role === "escort" || npc.role === "pirate" || police || bounty;
      const contact =
        police && this.policeContact?.officerId === npc.id
          ? this.policeContact
          : undefined;
      const chasing = police
        ? contact?.phase === "combat"
        : armed &&
          (npc.engaged ||
            (bounty
              ? level >= 4 && separation < 225
              : npc.role === "pirate"
                ? separation < 220
                : threatened));
      if (chasing) threats.push(npc);
      const fleeing =
        !armed &&
        npc.engaged &&
        separation < 500 &&
        distance(npc, npc.home) < 420;
      const phase = state.time * (police ? 0.05 : 0.22);
      const aim =
        chasing || contact
          ? ship
          : fleeing
            ? { x: npc.x * 2 - ship.x, y: npc.y * 2 - ship.y }
            : {
                x: npc.home.x + Math.cos(phase) * (police ? 560 : 55),
                y: npc.home.y + Math.sin(phase) * (police ? 430 : 29),
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
          : Math.min(
              contact
                ? separation > 135
                  ? 55
                  : 0
                : police
                  ? level
                    ? 76
                    : 64
                  : 21,
              length,
            );
      npc.angle = Math.atan2(dy, dx);
      npc.vx = Math.cos(npc.angle) * speed;
      npc.vy = Math.sin(npc.angle) * speed;
      npc.x += npc.vx * dt;
      npc.y += npc.vy * dt;
      if (chasing && separation < 260 && state.time >= npc.fireAt) {
        const ally = this.escorts.find(
          (escort) =>
            distance(npc, escort) < 260 &&
            distance(npc, escort) < separation + 25,
        );
        const travel = separation / 315;
        this.bolts.push(
          launch(
            npc,
            ally ?? {
              x: ship.x + ship.vx * travel,
              y: ship.y + ship.vy * travel,
            },
            315,
            npc.role === "elite" ? 9 : bounty ? 7 : 5,
            true,
          ),
        );
        npc.fireAt = state.time + 1.1;
      }
    }
    for (const escort of this.escorts) {
      const target = threats.find((npc) => distance(npc, escort) < 310);
      if (!target) continue;
      escort.angle = Math.atan2(target.y - escort.y, target.x - escort.x);
      if (state.time < escort.fireAt) continue;
      const tier = escortTiers[escort.pilot.tier];
      const travel = distance(escort, target) / 420;
      const bolt = launch(
        escort,
        { x: target.x + target.vx * travel, y: target.y + target.vy * travel },
        420,
        tier.damage,
        false,
      );
      this.bolts.push({ ...bolt, color: 0x80e4ae, escortTarget: target.id });
      escort.fireAt = state.time + tier.cooldown;
    }
    for (const npc of this.npcs) {
      if (npc.hull <= 0) continue;
      const impact = this.collide(state, npc);
      if (!impact) continue;
      impacts.push(impact);
      ship.hull = Math.max(0, ship.hull - impact.damage);
      if (damageNpcHull(state, system, npc, impact.damage)) {
        destroyed = true;
        bountyCompleted ||= npc.bountyTarget === true;
      }
      if (ship.hull <= 0) {
        playerDisabled = true;
        break;
      }
    }
    for (const bolt of this.bolts) {
      if (playerDisabled) break;
      bolt.life -= dt;
      if (bolt.life <= 0) continue;
      const dx = bolt.vx * dt,
        dy = bolt.vy * dt;
      const target = bolt.hostile ? undefined : this.boltTarget(bolt, dx, dy);
      bolt.x += dx;
      bolt.y += dy;
      if (bolt.hostile) {
        const ally = this.escorts.find(
          (escort) => !escort.pilot.repairUntil && distance(bolt, escort) <= 15,
        );
        if (ally) {
          bolt.life = 0;
          const pilot = ally.pilot;
          pilot.hull = Math.max(0, pilot.hull - bolt.damage);
          if (pilot.hull <= escortTiers[pilot.tier].hull * 0.2) {
            pilot.repairUntil = (state.activePlayTime ?? 0) + REPAIR_DURATION;
            retreated.push(pilot.name);
          }
          continue;
        }
        if (distance(bolt, ship) > 15) continue;
        bolt.life = 0;
        ship.hull -=
          bolt.damage * (state.upgrades.includes("shield") ? 0.5 : 1);
        if (ship.hull <= 0) {
          ship.hull = 0;
          playerDisabled = true;
          break;
        }
      } else {
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
        if (hitNpc(state, system, target, bolt.damage, bolt.shieldMultiplier)) {
          destroyed = true;
          bountyCompleted ||= target.bountyTarget === true;
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
    if (playerDisabled) {
      this.clearPoliceContact();
      for (const npc of this.npcs) npc.engaged = false;
    }
    this.bolts = playerDisabled
      ? []
      : this.bolts.filter((bolt) => bolt.life > 0);
    this.escorts = this.escorts.filter(({ pilot }) => !pilot.repairUntil);
    return {
      retreated,
      destroyed,
      playerDisabled,
      crimeReported,
      impacts,
      bountyCompleted,
    };
  }
}
