import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { Terrain } from "../game/procedural/terrain";
import { SaveDatabase } from "../persistence/database";
import {
  awardCareerXP,
  careerLevel,
  miningEfficiency,
  newProgression,
  xpForNextLevel,
} from "../progression/careers";

describe("carreiras galácticas", () => {
  it("separa as três profissões e aplica curva, patentes e limite", () => {
    const data = newProgression();
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(283);
    awardCareerXP(data, "explorer", 100, "Salto", 1);
    awardCareerXP(data, "miner", 99, "Mineração", 2);
    awardCareerXP(data, "pirate", -1, "Inválido", 3);
    expect(careerLevel("explorer", data.careers.explorer.xp)).toMatchObject({
      level: 2,
      progress: 0,
      target: 283,
    });
    expect(careerLevel("miner", data.careers.miner.xp).level).toBe(1);
    expect(data.careers.pirate.xp).toBe(0);
    awardCareerXP(
      data,
      "pirate",
      Number.MAX_SAFE_INTEGER,
      "Teste de limite",
      4,
    );
    expect(careerLevel("pirate", data.careers.pirate.xp)).toMatchObject({
      level: 30,
      rank: "Lenda Fora da Lei",
      target: 0,
    });
    expect(careerLevel("pirate", data.careers.pirate.xp, 100).level).toBe(30);
    awardCareerXP(
      data,
      "miner",
      Number.MAX_SAFE_INTEGER,
      "Teste de eficiência",
      5,
    );
    expect(miningEfficiency(data)).toBeCloseTo(0.2);
  });

  it("concede XP uma vez por planeta e conta apenas extração bem-sucedida", () => {
    setActivePinia(createPinia());
    const g = useGame();
    g.orbit(0);
    g.land(0);
    g.orbit(0);
    g.land(1);
    expect(g.state.progression.careers.explorer.xp).toBe(60);
    g.exit();
    g.state.changes[g.planet.id] = {};
    const terrain = new Terrain(g.planet, g.state.changes[g.planet.id]!);
    for (let x = -5; x < 5; x++) {
      expect(g.mineTerrain(terrain, x, 29)).toBe(true);
      expect(g.mineTerrain(terrain, x, 29)).toBe(false);
    }
    expect(g.state.progression.extracted).toBe(10);
    expect(g.state.progression.careers.miner.xp).toBe(20);
    expect(g.collect("iron")).toBe(true);
    expect(g.state.progression.extracted).toBe(10);
    g.state.mode = "space";
    expect(g.mineAsteroid("asteroid-fixture", "iron")).toBe(true);
    expect(g.mineAsteroid("asteroid-fixture", "iron")).toBe(false);
    expect(g.state.progression.extracted).toBe(13);
  });

  it("carrega um v4 anterior sem perder carga e persiste o progresso novo", async () => {
    setActivePinia(createPinia());
    const g = useGame();
    g.state.credits = 1210;
    g.state.inventory = { copper: 12 };
    const { progression, ...legacy } = JSON.parse(
      JSON.stringify(g.state),
    ) as typeof g.state;
    void progression;
    const db = new SaveDatabase(`careers-${crypto.randomUUID()}`);
    try {
      await db.saves.put({ id: "commander", data: legacy, updated: 1 });
      const migrated = (await db.read())!;
      expect(migrated.credits).toBe(1210);
      expect(migrated.inventory).toEqual({ copper: 12 });
      expect(migrated.progression).toEqual(newProgression());
      awardCareerXP(migrated.progression, "explorer", 100, "Sistema", 15);
      await db.write(migrated);
      expect(await db.read()).toEqual(migrated);
    } finally {
      await db.delete();
    }
  });
});

it("registra dados científicos uma vez e impede revender após recarregar", async () => {
  setActivePinia(createPinia());
  const g = useGame();
  const { sellScience } = await import("../progression/exploration");
  g.started = true;
  const s = g.state;
  g.scanPlanet(0);
  expect(Object.keys(s.progression.discoveries)).toHaveLength(0);
  s.ship.x = 420;
  g.scanPlanet(0);
  g.advancePlanetScan(2);
  s.ship.x = 1000;
  g.advancePlanetScan(1);
  expect(g.planetScan).toBeUndefined();
  s.ship.x = 420;
  g.scanPlanet(0);
  const id = `planet:${g.planet.id}`;
  expect(s.progression.discoveries[id]).toBeUndefined();
  g.advancePlanetScan(9);
  g.scanPlanet(0);
  expect(g.planetScan?.elapsed).toBe(9);
  expect(s.progression.discoveries[id]).toBeUndefined();
  g.paused = true;
  g.advancePlanetScan(1);
  expect(g.planetScan?.elapsed).toBe(9);
  g.paused = false;
  g.advancePlanetScan(1);
  const entry = s.progression.discoveries[id]!;
  expect(entry.notes).toContain("traje necessário");
  expect(s.progression.careers.explorer.xp).toBe(60);
  g.scanPlanet(0);
  expect(s.progression.careers.explorer.xp).toBe(60);
  expect(sellScience(s, id)).toBeTruthy();
  s.mode = "docked";
  const previous = s.credits;
  expect(sellScience(s, id)).toBeUndefined();
  expect(s.credits).toBe(previous + entry.credits);
  expect(sellScience(s, id)).toBeTruthy();
  const db = new SaveDatabase(`science-${crypto.randomUUID()}`);
  try {
    await db.write(s);
    expect(sellScience((await db.read())!, id)).toBeTruthy();
  } finally {
    await db.delete();
  }
});
