import { useConstruction } from "../stores/construction";
import { settlementFor } from "../construction/building";
import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import {
  oxygenFillingProgress,
  fillCartridge,
  loadCartridges,
  refillAutomatically,
} from "../survival/autoOxygen";
import { migrateSave } from "../persistence/migrations";
import { craft, recipes } from "../crafting/recipes";
import type { Inventory, PlacedPiece } from "../game/types";
function game() {
  setActivePinia(createPinia());
  return useGame();
}
describe("cartuchos e reabastecedor de oxigênio", () => {
  it("fabrica o vazio com exatamente quatro placas", () => {
    const inventory: Inventory = { plate: 4 };
    expect(
      craft(
        inventory,
        recipes.find((r) => r.id === "emptyOxygenCartridge")!,
        24,
        0,
      ),
    ).toBe(true);
    expect(inventory).toEqual({ emptyOxygenCartridge: 1 });
  });
  it("abastece com oxigênio do gerador normal sem duplicar recursos", () => {
    const inv: Inventory = { emptyOxygenCartridge: 2 };
    const generator: PlacedPiece = {
      kind: "oxygenGenerator",
      facing: 1,
      oxygen: 100,
    };
    expect(fillCartridge(inv, 24, generator)).toBe(true);
    expect(inv).toEqual({ emptyOxygenCartridge: 1, oxygenCartridge: 1 });
    expect(generator.oxygen).toBe(0);
    expect(fillCartridge(inv, 24, generator)).toBe(false);
    generator.oxygen = 100;
    expect(fillCartridge(inv, 24, generator)).toBe(true);
    expect(inv).toEqual({ oxygenCartridge: 2 });
  });
  it("exige gerador planetário ativo e energia na bateria", () => {
    const inv: Inventory = { emptyOxygenCartridge: 1 };
    const generator: PlacedPiece = {
      kind: "planetaryOxygenGenerator",
      facing: 1,
      powered: false,
    };
    const battery: PlacedPiece = { kind: "battery", facing: 1, energy: 20 };
    expect(fillCartridge(inv, 24, generator, battery)).toBe(false);
    generator.powered = true;
    expect(fillCartridge(inv, 24, generator, battery)).toBe(true);
    expect(battery.energy).toBe(10);
    expect(inv).toEqual({ oxygenCartridge: 1 });
  });
  it("não perde recipiente nem reserva se não houver espaço", () => {
    const inv: Inventory = { emptyOxygenCartridge: 2 };
    const generator: PlacedPiece = {
      kind: "oxygenGenerator",
      facing: 1,
      oxygen: 100,
    };
    expect(fillCartridge(inv, 1, generator)).toBe(false);
    expect(inv).toEqual({ emptyOxygenCartridge: 2 });
    expect(generator.oxygen).toBe(100);
  });
  it("limita a dez cartuchos e devolve os vazios no próprio equipamento", () => {
    const g = game(),
      p = g.state.player;
    const source: Inventory = { oxygenCartridge: 11 };
    p.autoOxygen = { cartridges: {} };
    expect(loadCartridges(source, p.autoOxygen.cartridges, 10)).toBe(true);
    expect(loadCartridges(source, p.autoOxygen.cartridges, 1)).toBe(false);
    p.oxygen = 30;
    expect(refillAutomatically(p)).toBe(false);
    p.oxygen = 29;
    expect(refillAutomatically(p)).toBe(true);
    expect(p.oxygen).toBe(100);
    expect(p.autoOxygen.cartridges).toEqual({
      oxygenCartridge: 9,
      emptyOxygenCartridge: 1,
    });
    expect(
      migrateSave(JSON.parse(JSON.stringify(g.state))).player.autoOxygen,
    ).toEqual(p.autoOxygen);
  });
  it("equipa e retira cartuchos sem duplicação", () => {
    const g = game();
    g.state.backpack = { autoOxygen: 1, oxygenCartridge: 2 };
    g.toggleAutoOxygen();
    g.moveAutoOxygen("oxygenCartridge", 2, true);
    g.toggleAutoOxygen();
    expect(g.state.player.autoOxygen?.cartridges.oxygenCartridge).toBe(2);
    g.moveAutoOxygen("oxygenCartridge", 2, false);
    g.toggleAutoOxygen();
    expect(g.state.player.autoOxygen).toBeUndefined();
    expect(g.state.backpack).toEqual({ autoOxygen: 1, oxygenCartridge: 2 });
  });
});

describe("animação de abastecimento", () => {
  function setup() {
    const g = game(),
      b = useConstruction();
    g.state.mode = "surface";
    g.state.backpack = { emptyOxygenCartridge: 2 };
    g.state.player.x = 88;
    g.state.player.y = 450;
    const data = settlementFor(g.state, g.planet.id);
    data.pieces["5,28"] = { kind: "oxygenGenerator", facing: 1, oxygen: 100 };
    b.interactAt(5, 28);
    return { g, b, data };
  }
  it("leva 10 segundos, impede cliques duplicados e só consome ao terminar", () => {
    const { g, b, data } = setup();
    vi.useFakeTimers();
    try {
      b.fillOxygenCartridge();
      b.fillOxygenCartridge();
      vi.advanceTimersByTime(5_000);
      expect(b.oxygenFillingElapsed).toBe(5_000);
      expect(data.pieces["5,28"]?.oxygen).toBe(100);
      expect(g.state.backpack).toEqual({ emptyOxygenCartridge: 2 });
      vi.advanceTimersByTime(5_000);
      expect(b.oxygenFillingElapsed).toBeNull();
      expect(g.state.backpack).toEqual({
        emptyOxygenCartridge: 1,
        oxygenCartridge: 1,
      });
      expect(data.pieces["5,28"]?.oxygen).toBe(0);
      data.pieces["5,28"]!.oxygen = 100;
      b.fillOxygenCartridge();
      expect(b.oxygenFillingElapsed).toBe(0);
      vi.advanceTimersByTime(10_000);
      expect(b.oxygenFillingElapsed).toBeNull();
      expect(g.state.backpack).toEqual({ oxygenCartridge: 2 });
    } finally {
      vi.useRealTimers();
    }
  });
  it.each(["fechar", "pausar", "afastar", "remover"])(
    "cancela ao %s sem perder cartucho ou recursos",
    (action) => {
      const { g, b, data } = setup();
      vi.useFakeTimers();
      try {
        b.fillOxygenCartridge();
        vi.advanceTimersByTime(5_000);
        if (action === "fechar") g.panel = "";
        if (action === "pausar") g.paused = true;
        if (action === "afastar") g.state.player.x += 200;
        if (action === "remover") delete data.pieces["5,28"];
        vi.advanceTimersByTime(10_000);
        expect(b.oxygenFillingElapsed).toBeNull();
        expect(g.state.backpack).toEqual({ emptyOxygenCartridge: 2 });
        if (action !== "remover") expect(data.pieces["5,28"]?.oxygen).toBe(100);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

it("não interpreta progresso ausente ou inválido como abastecimento em curso", () => {
  for (const invalid of [undefined, null, NaN, Infinity, -1])
    expect(oxygenFillingProgress(invalid)).toBeNull();
  expect(oxygenFillingProgress(0)).toEqual({
    elapsed: 0,
    percent: 0,
    seconds: 10,
  });
  expect(oxygenFillingProgress(5000)).toEqual({
    elapsed: 5000,
    percent: 50,
    seconds: 5,
  });
});
