import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it } from "vitest";
import {
  applyCivicAction,
  civicAid,
  civilizationOf,
  planetaryInfluence,
} from "../diplomacy/governance";
import { migrateSave } from "../persistence/migrations";
import { useGame } from "../stores/game";

it("libera o governo por votação em planetas habitados e persiste a influência", () => {
  setActivePinia(createPinia());
  const g = useGame();
  const s = g.state;
  s.mode = "surface";
  expect(civilizationOf(g.planet)).toBeUndefined();
  expect(applyCivicAction(s, g.planet, "supplies", 100)).toBeTruthy();
  s.planetIndex = 1;
  const planet = g.planet;
  expect(civilizationOf(planet)).toBeDefined();
  expect(applyCivicAction(s, planet, "govern", 100)).toBeTruthy();
  s.backpack = {
    ...civicAid.supplies.cost,
    ...civicAid.communications.cost,
    ...civicAid.energy.cost,
  };
  for (const action of ["supplies", "communications", "energy"] as const) {
    expect(applyCivicAction(s, planet, action, 100)).toBeUndefined();
    expect(applyCivicAction(s, planet, action, 100)).toBeTruthy();
  }
  expect(applyCivicAction(s, planet, "govern", 100)).toBeUndefined();
  expect(planetaryInfluence(s.governments?.[planet.id])).toBe(80);
  s.credits = 6000;
  expect(applyCivicAction(s, planet, "clinic", 100)).toBeUndefined();
  expect(applyCivicAction(s, planet, "logistics", 100)).toBeUndefined();
  expect(planetaryInfluence(s.governments?.[planet.id])).toBe(100);
  expect(migrateSave(s).governments?.[planet.id]?.governed).toBe(true);
});
