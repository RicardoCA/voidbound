import { expect, it } from "vitest";
import { ruinAt } from "../progression/exploration";
import { systemAt } from "../universe/generator";
import { emptySettlement } from "../construction/building";
import { representativePosition } from "../diplomacy/representative";
import type { Terrain } from "../game/procedural/terrain";

const terrain = {
  get: (_x: number, y: number) => (y >= 29 ? 1 : 0),
} as Terrain;

it("mantém o representante fora da casa e do espaço de móveis largos", () => {
  const settlement = emptySettlement();
  for (let x = 4; x <= 12; x++) {
    settlement.pieces[`${x},24`] = { kind: "woodBlock", facing: 1 };
    settlement.walls[`${x},28`] = true;
  }
  settlement.pieces["14,28"] = { kind: "cabinetTriple", facing: 1 };
  const position = representativePosition(terrain, settlement, 0)!;
  expect(position.x).toBe(-5 * 16 + 8);
  expect(position.y).toBe(29 * 16 - 13);
  expect(representativePosition(terrain, settlement, 0)).toEqual(position);
});

it("reposiciona quando há construção e acompanha o solo minerado", () => {
  const settlement = emptySettlement();
  expect(representativePosition(terrain, settlement, 0)?.x).toBe(104);
  settlement.pieces["6,28"] = { kind: "woodDoor", open: true, facing: 1 };
  const mined = {
    get: (_x: number, y: number) => (y >= 32 ? 1 : 0),
  } as Terrain;
  expect(representativePosition(mined, settlement, 0)).toEqual({
    x: 136,
    y: 499,
  });
});

it("desloca a ruína inteira para fora do telhado e preserva a descoberta", () => {
  const planets = Array.from(
    { length: 12 },
    (_, x) => systemAt("VOIDBOUND", x, 0).planets,
  ).flat();
  const planet = planets.find((body) => ruinAt(body, terrain))!;
  const original = ruinAt(planet, terrain)!;
  const column = Math.floor(original.x / 16);
  const settlement = emptySettlement();
  settlement.pieces[`${column + 2},20`] = { kind: "woodBlock", facing: 1 };
  const relocated = ruinAt(planet, terrain, settlement)!;
  expect(relocated.id).toBe(original.id);
  expect(Math.abs(Math.floor(relocated.x / 16) - (column + 2))).toBeGreaterThan(
    2,
  );
});
