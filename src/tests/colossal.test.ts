import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { expect, it, vi } from "vitest";
import {
  addColossalBay,
  bayCost,
  buildColossal,
  colossalStages,
  loadColossalFuel,
  selectColossalShip,
  steerColossal,
  transferColossalShip,
} from "../fleet/colossal";
import { inLocalHangar, registerShip } from "../fleet/hangar";
import { migrateSave } from "../persistence/migrations";
import { useGame } from "../stores/game";
import { systemExists } from "../universe/generator";

it("constrói a colossal, expande o hangar e transporta as naves em um salto longo", async () => {
  setActivePinia(createPinia());
  const g = useGame();
  const s = g.state;
  g.started = true;
  g.autosaveEnabled = false;
  s.mode = "docked";
  expect(buildColossal(s, 240, 80)).toBeTruthy();
  for (const [index, stage] of colossalStages.entries()) {
    s.inventory = { ...stage.cost };
    expect(buildColossal(s, 240, 80)).toBeUndefined();
    expect(s.colossal?.stage).toBe(index + 1);
    expect(s.inventory).toEqual({});
  }
  registerShip(s, "atlas");
  const atlas = s.parkedShips[0];
  s.mode = "space";
  Object.assign(s.ship, { x: 240, y: 80, vx: 0, vy: 0 });
  expect(g.boardColossal()).toBe(true);
  s.inventory = { ...bayCost };
  expect(addColossalBay(s)).toBeUndefined();
  g.leaveColossal();
  s.mode = "docked";
  expect(transferColossalShip(s, atlas.id)).toBeUndefined();
  expect(inLocalHangar(s, atlas)).toBe(false);
  s.mode = "space";
  Object.assign(s.ship, { x: 240, y: 80, vx: 0, vy: 0 });
  expect(g.boardColossal()).toBe(true);
  expect(selectColossalShip(s, atlas.id)).toBeUndefined();
  s.inventory = { fuel: 10, warpFuel: 100 };
  expect(loadColossalFuel(s, "fuel")).toBeUndefined();
  expect(loadColossalFuel(s, "warpFuel")).toBeUndefined();
  const x = [15, 16, 17, 18, 19].find((sector) =>
    systemExists(s.seed, sector, 0),
  )!;
  vi.useFakeTimers();
  try {
    const jumping = g.jumpColossal(x, 0);
    expect(g.jumpCountdown).toBeUndefined();
    expect(g.colossalJumpMs).toBe(4000 + x * 200);
    await vi.advanceTimersByTimeAsync(4000 + x * 200);
    await jumping;
    expect(g.jumpCountdown).toBe(30);
  } finally {
    vi.useRealTimers();
  }
  expect(g.aboardColossal).toBe(true);
  expect(s.systemX).toBe(x);
  expect(s.colossal?.warp).toBe(100 - x * 3);
  expect(s.colossal?.fuel).toBe(10);
  expect(s.parkedShips[0].location).toEqual({ x, y: 0 });
  expect(migrateSave(JSON.parse(JSON.stringify(s))).colossal).toEqual(
    s.colossal,
  );
});

it("gira, acelera, conserva o embalo sem combustível e freia a colossal", () => {
  const carrier = {
    stage: 3,
    sector: { x: 0, y: 0 },
    x: 0,
    y: 0,
    fuel: 0.34,
    warp: 3,
    slots: 1,
    ships: [],
    vx: 0,
    vy: 0,
    angle: 0,
  };
  steerColossal(carrier, 1, 1, true, false);
  expect(carrier.angle).toBe(1.35);
  expect(carrier.fuel).toBe(0);
  const { x, y, vx, vy } = carrier;
  steerColossal(carrier, 1, -1, true, false);
  expect(carrier.x).toBeCloseTo(x + vx);
  expect(carrier.y).toBeCloseTo(y + vy);
  steerColossal(carrier, 1, 0, false, true);
  expect(Math.hypot(carrier.vx, carrier.vy)).toBeCloseTo(21 * Math.exp(-2));
  expect(carrier.warp).toBe(3);
});
