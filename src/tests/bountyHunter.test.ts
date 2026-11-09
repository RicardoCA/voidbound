import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import { SpaceCombat } from "../combat/flight";
import { wantedStatus } from "../combat/law";
import { systemWrecks } from "../combat/traffic";
import { migrateSave } from "../persistence/migrations";
import {
  acceptContract,
  claimContract,
  contractOffers,
  contractStatus,
} from "../progression/contracts";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";

describe("caçador de recompensas", () => {
  it("paga uma vez pelo pirata correto sem registrar crime mesmo com testemunha", () => {
    setActivePinia(createPinia());
    const g = useGame();
    const s = g.state;
    const station = g.system.station!;
    expect(
      contractOffers(s, systemAt(s.seed, 1, 0)).some(
        (c) => c.career === "bountyHunter",
      ),
    ).toBe(false);
    const offer = contractOffers(s, g.system).find(
      (c) => c.career === "bountyHunter",
    )!;
    s.mode = "docked";
    expect(acceptContract(s, station.id, offer.id)).toBeUndefined();
    expect(claimContract(s, station.id, offer.id)).toBeTruthy();
    s.mode = "space";
    const combat = new SpaceCombat();
    combat.reset(s, g.system);
    combat.update(s, g.system, 0);
    const target = combat.npcs.find((npc) => npc.bountyTarget)!;
    expect(target.role).toBe("pirate");
    const witness = combat.npcs.find((npc) => npc.role === "freighter")!;
    Object.assign(witness, { x: target.x + 40, y: target.y });
    combat.bolts.push({
      x: target.x,
      y: target.y,
      vx: 0,
      vy: 0,
      life: 1,
      hostile: false,
      damage: 250,
    });
    expect(combat.update(s, g.system, 0)).toMatchObject({
      destroyed: true,
      bountyCompleted: true,
      crimeReported: false,
    });
    expect(wantedStatus(s, g.system).level).toBe(0);
    expect(s.progression.crimes).toEqual([]);
    expect(
      systemWrecks(g.system.id, s.progression.piracy).map((wreck) => wreck.id),
    ).toContain(target.id);
    expect(contractStatus(s, offer)).toBe("COMPLETED");
    expect(claimContract(s, station.id, offer.id)).toBeTruthy();
    s.mode = "docked";
    expect(claimContract(s, station.id, offer.id)).toBeUndefined();
    expect(claimContract(s, station.id, offer.id)).toBeTruthy();
    expect(s.credits).toBe(500 + offer.credits);
    expect(s.progression.careers.bountyHunter.xp).toBe(offer.xp);
  });

  it("adiciona a carreira a um save antigo sem perder o XP existente", () => {
    setActivePinia(createPinia());
    const s = useGame().state;
    s.progression.careers.miner.xp = 140;
    Reflect.deleteProperty(s.progression.careers, "bountyHunter");
    const restored = migrateSave(s);
    expect(restored.progression.careers.miner.xp).toBe(140);
    expect(restored.progression.careers.bountyHunter.xp).toBe(0);
  });
});
