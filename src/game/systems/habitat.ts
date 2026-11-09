import type { Planet, Save, Settlement } from "../types";
import { Terrain } from "../procedural/terrain";
import { LRU } from "../procedural/random";
import {
  analyzeRoom,
  advancePowerNetwork,
  BATTERY_CAP,
  emptyHabitat,
  powerNetwork,
  REFILL_RATE,
  type PowerNetwork,
  type Room,
  type HabitatReport,
} from "../../construction/habitat";
import { keyAt } from "../../construction/pieces";
/** Topology is cached until construction, terrain or a door changes. */
export class HabitatSystem {
  private state?: Save;
  private planet = "";
  private data?: Settlement;
  private changes?: Record<string, number>;
  private revision = -1;
  private terrain?: Terrain;
  private network?: PowerNetwork;
  private rooms = new LRU<string, Room>(32);
  step(
    state: Save,
    planet: Planet,
    revision: number,
    dt: number,
  ): HabitatReport {
    const data = state.settlements[planet.id],
      changes = state.changes[planet.id];
    if (!data) return emptyHabitat();
    if (
      this.state !== state ||
      this.planet !== planet.id ||
      this.data !== data ||
      this.changes !== changes ||
      this.revision !== revision
    ) {
      this.state = state;
      this.planet = planet.id;
      this.data = data;
      this.changes = changes;
      this.revision = revision;
      this.terrain = new Terrain(planet, changes ?? {});
      this.network = powerNetwork(this.terrain, data);
      this.rooms.clear();
    }
    const network = this.network!,
      now = state.time,
      from = Math.min(now, data.utilityTime ?? Math.max(0, now - dt));
    advancePowerNetwork(data, network, from, now);
    if (
      network.generators.length ||
      network.batteries.length ||
      network.fridges.length
    )
      data.utilityTime = now;
    const report = {
      ...emptyHabitat(),
      panels: network.panels,
      exposedPanels: network.exposedPanels,
      generators: network.generators.length,
    };
    function reportPower(generators: PowerNetwork["generators"]) {
      const keys = new Set(generators.flatMap((g) => g.batteries));
      report.batteries = keys.size;
      report.batteryCapacity = keys.size * BATTERY_CAP;
      report.batteryEnergy = [...keys].reduce(
        (sum, key) => sum + (data!.pieces[key]!.energy ?? 0),
        0,
      );
      report.connectedPanels =
        generators.reduce((sum, g) => sum + g.panels, 0) +
        network.batteries
          .filter((b) => keys.has(b.key))
          .reduce((sum, b) => sum + b.panels, 0);
    }
    if (state.mode !== "surface") return report;
    const player = state.player,
      px = Math.floor(player.x / 16),
      py = Math.floor(player.y / 16),
      cell = keyAt(px, py),
      head = keyAt(px, Math.floor((player.y - 10) / 16)),
      feet = keyAt(px, Math.floor((player.y + 10) / 16));
    const inside = network.generators.filter(
      (g) =>
        g.room.sealed &&
        g.room.cells.has(cell) &&
        g.room.cells.has(head) &&
        g.room.cells.has(feet),
    );
    if (inside.length) {
      report.sealed = true;
      report.hasGenerator = true;
      report.reason = "no-power";
      reportPower(inside);
      for (const generator of inside) {
        const piece = data.pieces[generator.key]!;
        report.energy += piece.energy ?? 0;
        const oxygen = piece.oxygen ?? 0;
        if (oxygen <= 0) continue;
        const breathable = Math.max(0, oxygen - 0.38 * dt),
          requested = Math.min(
            Math.max(0, 100 - player.oxygen),
            REFILL_RATE * dt,
          ),
          gain = Math.min(requested, breathable);
        player.oxygen = Math.min(100, player.oxygen + gain);
        piece.oxygen = Math.max(0, breathable - gain);
        report.gain += gain;
        report.supplied = true;
        report.reason = "sealed";
      }
      report.oxygen = inside.reduce(
        (sum, g) => sum + (data.pieces[g.key]!.oxygen ?? 0),
        0,
      );
      return report;
    }
    const nearest = [...network.generators].sort(
      (a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py),
    )[0];
    if (nearest && Math.hypot(nearest.x - px, nearest.y - py) <= 16) {
      const piece = data.pieces[nearest.key]!;
      report.hasGenerator = true;
      report.reason = nearest.room.sealed ? "outside" : nearest.room.reason;
      reportPower([nearest]);
      report.energy = piece.energy ?? 0;
      report.oxygen = piece.oxygen ?? 0;
    }
    if (data.walls[cell]) {
      let room = this.rooms.get(cell);
      if (!room) {
        room = analyzeRoom(this.terrain!, data, px, py);
        this.rooms.set(cell, room);
      }
      if (room.sealed) {
        report.sealed = true;
        report.reason = "no-generator";
      } else if (!nearest) report.reason = room.reason;
    }
    return report;
  }
}
