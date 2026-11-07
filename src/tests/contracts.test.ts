import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { awardCareerXP } from "../progression/careers";
import {
  acceptContract,
  abandonContract,
  claimContract,
  contractOffers,
  contractStatus,
} from "../progression/contracts";
import { SaveDatabase } from "../persistence/database";

function docked() {
  setActivePinia(createPinia());
  const g = useGame();
  g.state.mode = "docked";
  return { g, station: g.system.station!.id };
}

describe("contratos procedurais", () => {
  it("gera ofertas estáveis e libera contratos industriais por nível", () => {
    const { g } = docked();
    const offers = contractOffers(g.state, g.system);
    expect(contractOffers(g.state, g.system)).toEqual(offers);
    expect(offers.filter((offer) => offer.career === "miner")).toHaveLength(1);
    awardCareerXP(
      g.state.progression,
      "miner",
      Number.MAX_SAFE_INTEGER,
      "Teste de graduação",
      0,
    );
    const advanced = contractOffers(g.state, g.system).filter(
      (offer) => offer.career === "miner",
    );
    expect(advanced).toHaveLength(4);
    expect(advanced[3]!.credits).toBe(40000);
  });

  it("exige o lote e a estação corretos, paga uma vez e salva a entrega", async () => {
    const { g, station } = docked();
    const s = g.state;
    const offer = contractOffers(s, g.system).find(
      (c) => c.goal.kind === "delivery",
    )!;
    const goal = offer.goal;
    if (goal.kind !== "delivery") throw new Error("Lote de teste ausente");
    expect(acceptContract(s, station, offer.id)).toBeUndefined();
    expect(acceptContract(s, station, offer.id)).toBeTruthy();
    expect(claimContract(s, station, offer.id)).toBeTruthy();
    expect(s.credits).toBe(500);
    s.inventory[goal.item] = goal.quantity + 2;
    expect(contractStatus(s, offer)).toBe("COMPLETED");
    expect(claimContract(s, "outra-estação", offer.id)).toBeTruthy();
    expect(claimContract(s, station, offer.id)).toBeUndefined();
    expect(s.inventory[goal.item]).toBe(2);
    expect(s.credits).toBe(500 + offer.credits);
    expect(s.progression.careers.miner.xp).toBe(offer.xp);
    expect(contractStatus(s, offer)).toBe("CLAIMED");
    const db = new SaveDatabase(`contract-${crypto.randomUUID()}`);
    try {
      await db.write(s);
      expect(claimContract((await db.read())!, station, offer.id)).toBeTruthy();
    } finally {
      await db.delete();
    }
  });

  it("conclui levantamento por pouso e não permite entregar um contrato abandonado", () => {
    const { g, station } = docked();
    const s = g.state;
    const offer = contractOffers(s, g.system).find(
      (c) => c.goal.kind === "discovery",
    )!;
    expect(acceptContract(s, station, offer.id)).toBeUndefined();
    expect(contractStatus(s, offer)).toBe("ACTIVE");
    g.orbit(0);
    g.land(0);
    expect(contractStatus(s, offer)).toBe("COMPLETED");
    s.mode = "docked";
    expect(claimContract(s, station, offer.id)).toBeUndefined();
    expect(s.progression.careers.explorer.xp).toBe(410);
    const supply = contractOffers(s, g.system).find(
      (c) => c.career === "miner",
    )!;
    expect(acceptContract(s, station, supply.id)).toBeUndefined();
    expect(abandonContract(s, station, supply.id)).toBeUndefined();
    expect(contractStatus(s, supply)).toBe("FAILED");
    expect(claimContract(s, station, supply.id)).toBeTruthy();
  });
});
