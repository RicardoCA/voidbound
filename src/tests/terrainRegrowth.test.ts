import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it } from "vitest";
import { emptySettlement } from "../construction/building";
import {
  regrowTerrain,
  TERRAIN_REGROWTH_SECONDS,
} from "../game/procedural/terrainRegrowth";
import { useGame } from "../stores/game";

it("regenera blocos antigos após 24 horas ativas e adia blocos sob construções", () => {
  setActivePinia(createPinia());
  const { state } = useGame();
  const planetId = "test-planet";
  state.changes[planetId] = { "0,29": 0, "1,29": 0 };
  const settlement = (state.settlements[planetId] = emptySettlement());
  settlement.pieces["1,29"] = { kind: "woodBlock", facing: 1 };
  state.activePlayTime = 100;
  expect(regrowTerrain(state)).toBe(false);
  state.activePlayTime += TERRAIN_REGROWTH_SECONDS - 1;
  expect(regrowTerrain(state)).toBe(false);
  state.activePlayTime++;
  expect(regrowTerrain(state)).toBe(true);
  expect(state.changes[planetId]).toEqual({ "1,29": 0 });
  delete settlement.pieces["1,29"];
  expect(regrowTerrain(state)).toBe(true);
  expect(state.changes[planetId]).toEqual({});
});
