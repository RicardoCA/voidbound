import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { emptySettlement, settlementFor } from "../construction/building";
import { Terrain } from "../game/procedural/terrain";
import {
  planetPrecipitation,
  weatherAt,
  weatherCeiling,
} from "../game/procedural/weather";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";

describe("clima planetário", () => {
  it("tem planetas secos e clima reproduzível, com neve apenas nos gelados", () => {
    const planet = systemAt("clima", 0, 0).planets[0]!;
    const kinds = new Set<string | undefined>();
    for (let kind = 0; kind < 6; kind++) {
      for (let seed = 0; seed < 50; seed++) {
        const candidate = { ...planet, seed, kind };
        const type = planetPrecipitation(candidate);
        kinds.add(type);
        if (type === "snow") expect(kind).toBe(2);
        expect(weatherAt(candidate, 0)).toBeUndefined();
        const sequence = Array.from({ length: 265 }, (_, time) =>
          weatherAt(candidate, time),
        );
        expect(sequence.some((storm) => storm?.intensity === 1)).toBe(
          Boolean(type),
        );
        expect(sequence[100]).toEqual(weatherAt(candidate, 100));
      }
    }
    expect(kinds).toEqual(new Set([undefined, "rain", "acid", "snow"]));
  });

  it("chuva ácida tira vida ao ar livre e um teto interrompe o dano", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const systems = Array.from({ length: 20 }, (_, i) =>
      systemAt(g.state.seed, i, 0),
    );
    const system = systems.find((candidate) =>
      candidate.planets.some(
        (planet) => planetPrecipitation(planet) === "acid",
      ),
    )!;
    g.state.systemX = system.x;
    g.state.planetIndex = system.planets.findIndex(
      (planet) => planetPrecipitation(planet) === "acid",
    );
    g.state.mode = "surface";
    g.started = true;
    const time = Array.from({ length: 265 }, (_, i) => i).find(
      (t) => weatherAt(g.planet, t)?.intensity === 1,
    )!;
    g.state.time = time;
    g.state.player.x = 88;
    g.state.player.y = 452;
    const terrain = new Terrain(g.planet, {});
    expect(weatherCeiling(terrain, emptySettlement(), 5)).toBe(29 * 16);
    g.tick(0.5);
    const exposed = g.state.player.health;
    expect(exposed).toBeLessThan(99.5);
    const settlement = settlementFor(g.state, g.planet.id);
    settlement.pieces["5,24"] = { kind: "woodBlock", facing: 1 };
    expect(weatherCeiling(terrain, settlement, 5)).toBe(24 * 16);
    g.tick(0.5);
    expect(exposed - g.state.player.health).toBeLessThanOrEqual(0.25);
  });
});
