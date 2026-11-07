import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { SpaceCombat } from "../combat/flight";
import {
  jurisdiction,
  payFines,
  reportCrime,
  wantedStatus,
  wantedBySystem,
} from "../combat/law";
import { hasBlackMarket, trafficFor } from "../combat/traffic";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";

describe("tráfego e autoridades espaciais", () => {
  it("mantém corsários apenas em sistemas clandestinos e preserva o tráfego civil", () => {
    setActivePinia(createPinia());
    const g = useGame(),
      state = g.state;
    for (let i = 0; i < 24; i++) {
      const system = systemAt(state.seed, i, 0);
      const roles = trafficFor(system, state.progression.piracy).map(
        (npc) => npc.role,
      );
      expect(roles.includes("pirate")).toBe(hasBlackMarket(system));
      expect(roles).toEqual(
        expect.arrayContaining(["freighter", "miner", "escort"]),
      );
    }
  });

  it("mantém alertas por sistema, mesmo na mesma facção, e preserva multas ao esfriar", async () => {
    setActivePinia(createPinia());
    const g = useGame(),
      s = g.state,
      origin = g.system;
    s.progression.careers.pirate.xp = 160;
    reportCrime(s, origin, "Cargueiro", "assault", true, false);
    reportCrime(s, origin, "Cargueiro", "destruction", true, false);
    const allied = systemAt(s.seed, 1, 0);
    const rival = Array.from({ length: 20 }, (_, i) =>
      systemAt(s.seed, 4 * (i + 1), 0),
    ).find(
      (system) => jurisdiction(system).faction !== jurisdiction(origin).faction,
    )!;
    expect(wantedStatus(s, origin)).toMatchObject({
      level: 3,
      fine: 660,
      bounty: 1050,
    });
    expect(wantedStatus(s, allied)).toMatchObject({ level: 0, fine: 660 });
    expect([...wantedBySystem(s)]).toEqual([[origin.id, 3]]);
    const flight = new SpaceCombat();
    s.systemX = allied.x;
    s.systemY = allied.y;
    flight.reset(s, allied);
    flight.update(s, allied, 0.04);
    expect(flight.bolts).toHaveLength(0);
    expect(flight.npcs.some((npc) => npc.role === "bounty")).toBe(false);
    s.systemX = origin.x;
    s.systemY = origin.y;
    expect(wantedStatus(s, rival)).toMatchObject({
      level: 0,
      fine: 0,
      galacticBounty: 1050,
    });
    s.time = 600;
    expect(wantedBySystem(s).size).toBe(0);
    expect(wantedStatus(s, origin)).toMatchObject({
      level: 0,
      fine: 660,
      bounty: 1050,
    });
    const db = new SaveDatabase(`law-${crypto.randomUUID()}`);
    try {
      await db.write(s);
      const saved = (await db.read())!;
      expect(saved.progression.crimes).toEqual(
        JSON.parse(JSON.stringify(s.progression.crimes)),
      );
      saved.mode = "docked";
      expect(payFines(saved)).toBeTruthy();
      saved.credits = 800;
      expect(payFines(saved)).toBeUndefined();
      expect(payFines(saved)).toBeTruthy();
      expect(saved.credits).toBe(140);
      expect(wantedStatus(saved, origin)).toMatchObject({ fine: 0, bounty: 0 });
      expect(saved.progression.careers.pirate.xp).toBe(160);
    } finally {
      await db.delete();
    }
  });

  it("mobiliza polícia, caçador e elite conforme o alerta e bloqueia acoplagem no nível cinco", () => {
    setActivePinia(createPinia());
    const g = useGame(),
      s = g.state,
      system = g.system;
    const flight = new SpaceCombat();
    flight.reset(s, system);
    flight.update(s, system, 0.016);
    expect(flight.npcs.some((npc) => npc.role === "bounty")).toBe(false);
    reportCrime(s, system, "Cargueiro", "destruction", true, false);
    flight.update(s, system, 0.016);
    expect(flight.npcs.some((npc) => npc.role === "police")).toBe(true);
    reportCrime(s, system, "Patrulha", "assault", true, true);
    flight.update(s, system, 0.016);
    expect(g.wanted.level).toBe(4);
    expect(flight.npcs.some((npc) => npc.role === "bounty")).toBe(true);
    reportCrime(s, system, "Patrulha", "destruction", true, true);
    for (let step = 0; step < 90; step++) {
      s.time += 0.016;
      flight.update(s, system, 0.016);
    }
    expect(flight.npcs.some((npc) => npc.role === "elite")).toBe(true);
    expect(flight.bolts.some((bolt) => bolt.hostile) || s.ship.hull < 55).toBe(
      true,
    );
    g.started = true;
    Object.assign(s.ship, {
      x: system.station!.x,
      y: system.station!.y,
      vx: 0,
      vy: 0,
    });
    expect(g.dock()).toBe(true);
    expect(s.mode).toBe("space");
    expect(g.notice).toContain("Acoplagem bloqueada");
  });
});
