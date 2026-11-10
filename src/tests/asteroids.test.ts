import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import {
  buyScannerBlueprint,
  isShipScanner,
  shipScanners,
} from "../combat/shipScanners";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";
import { ASTEROID_RESPAWN_SECONDS } from "../universe/asteroids";

describe("reposição de asteroides", () => {
  it("libera as rotas de asteroides somente após comprar, fabricar e instalar o radar", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    s.mode = "docked";
    s.credits = 10_000;
    s.inventory = { ...shipScanners.asteroidRadar.cost };
    g.make("asteroidRadar");
    expect(s.inventory.asteroidRadar).toBeUndefined();
    s.systemX = 1;
    expect(buyScannerBlueprint(s, "asteroidRadar")).toBeTruthy();
    s.systemX = 0;
    expect(buyScannerBlueprint(s, "asteroidRadar")).toBeUndefined();
    expect(s.credits).toBe(2_000);
    g.make("asteroidRadar");
    expect(s.inventory.asteroidRadar).toBe(1);
    expect(g.hasAsteroidRadar).toBe(false);
    g.use("asteroidRadar");
    expect(g.hasAsteroidRadar).toBe(true);
    expect(isShipScanner("asteroidRadar")).toBe(false);
    s.mode = "space";
    g.setRoute(g.asteroids[0]!.id);
    expect(g.routeDestination?.stopDistance).toBe(68);
    s.upgrades = [];
    expect(g.routeDestination).toBeUndefined();
    g.setRoute(g.system.planets[0]!.id);
    expect(g.routeDestination?.stopDistance).toBe(135);
  });

  it("reaparece em outra posição após dez minutos ativos, inclusive após carregar o save", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    g.started = true;
    g.autosaveEnabled = false;
    const rock = g.asteroids[0]!;
    g.setRoute(rock.id);
    expect(g.routeDestination).toBeUndefined();
    g.state.upgrades.push("asteroidRadar");
    g.setRoute(rock.id);
    expect(g.routeDestination?.name).toBe(rock.name);
    expect(g.mineAsteroid(rock.id)).toBe(true);
    expect(g.routeDestination).toBeUndefined();
    expect(g.mineAsteroid(rock.id)).toBe(false);
    g.state.time += 800;
    expect(g.asteroids.some(({ id }) => id === rock.id)).toBe(false);
    g.paused = true;
    g.tickActiveTime(ASTEROID_RESPAWN_SECONDS);
    expect(g.asteroids.some(({ id }) => id === rock.id)).toBe(false);
    g.paused = false;
    g.tickActiveTime(ASTEROID_RESPAWN_SECONDS - 1);

    const db = new SaveDatabase(`asteroids-${crypto.randomUUID()}`);
    try {
      await db.write(g.state);
      g.state = (await db.read())!;
      expect(g.asteroids.some(({ id }) => id === rock.id)).toBe(false);
      g.tickActiveTime(1);
      const replacement = g.asteroids.find(({ id }) => id === rock.id)!;
      expect(replacement).toBeDefined();
      expect(replacement.x).not.toBe(rock.x);
      expect(replacement.y).not.toBe(rock.y);
      expect(g.mineAsteroid(rock.id)).toBe(true);
      g.tickActiveTime(ASTEROID_RESPAWN_SECONDS);
      expect(g.asteroids.find(({ id }) => id === rock.id)?.x).not.toBe(
        replacement.x,
      );
    } finally {
      await db.delete();
    }
  });

  it("recupera campos esgotados em saves que guardavam apenas a lista de IDs", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const original = g.asteroids[0]!;
    g.state.depleted = g.asteroids.map(({ id }) => id);
    expect(g.asteroids).toHaveLength(0);
    g.state.activePlayTime = ASTEROID_RESPAWN_SECONDS;
    expect(g.asteroids).toHaveLength(70);
    expect(g.asteroids[0]?.x).not.toBe(original.x);
  });
});
