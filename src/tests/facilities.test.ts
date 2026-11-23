import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import {
  emptySettlement,
  removePiece,
  placePiece,
} from "../construction/building";
import {
  enqueueFacility,
  machineAt,
  advanceFacility,
  geologicalDeposits,
  observatoryClues,
  FACILITY_SLOTS,
} from "../construction/facilities";
import {
  facilityDefinitions,
  type FacilityKind,
} from "../construction/facilityTypes";
import { powerNetwork, advancePowerNetwork } from "../construction/habitat";
import { Terrain } from "../game/procedural/terrain";
import { forecastWeather, weatherAt } from "../game/procedural/weather";
import { systemAt } from "../universe/generator";
import { FacilitySystem } from "../game/systems/facilities";
import { SaveDatabase } from "../persistence/database";
import { migrateSave } from "../persistence/migrations";
import { scanSite, sellScience } from "../progression/exploration";
import { pieceAt } from "../construction/pieces";
import { solidSurfaceVoxel } from "../game/physics/surfaceDepth";
import { recipes } from "../crafting/recipes";
beforeEach(() => setActivePinia(createPinia()));
function setup(kind: FacilityKind = "planetRefinery") {
  const g = useGame();
  g.newGame("VOIDBOUND");
  g.state.mode = "surface";
  g.state.player.x = 16;
  g.state.player.y = 440;
  g.state.player.surfaceZ = 0;
  const data = (g.state.settlements[g.planet.id] = emptySettlement());
  data.pieces["0,28"] = { kind, facing: 1 };
  const terrain = new Terrain(g.planet, {});
  const machine = machineAt(data, "0,28")!;
  return { g, data, terrain, machine };
}
describe("instalações planetárias", () => {
  it.each(Object.keys(facilityDefinitions) as FacilityKind[])(
    "%s tem receita, interação, colisão e suporte",
    (kind) => {
      const { g, data, terrain } = setup(kind);
      expect(recipes.find((r) => r.id === kind)?.station).toBe("bench");
      expect(pieceAt(data, 1, 27)?.key).toBe("0,28");
      expect(solidSurfaceVoxel(terrain, data, 1, 27, 0)).toBe(true);
      const b = useConstruction();
      expect(b.interactAt(1, 27)).toBe(true);
      expect(g.panel).toBe("facility");
      expect(b.facility?.kind).toBe(kind);
      g.state.player.x = 1000;
      expect(b.queueFacility("scan", 1)).toBe(false);
    },
  );
  it("reserva ingredientes uma vez, avança só com energia e conclui em fila", () => {
    const { g, data, terrain, machine } = setup();
    machine.input = { iron: 6 };
    expect(enqueueFacility(data, "0,28", "plate", 2)).toBeUndefined();
    expect(machine.input.iron).toBeUndefined();
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 12);
    expect(machine.output.plate).toBeUndefined();
    machine.energySeconds = 12;
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 12);
    expect(machine.output.plate).toBe(1);
    expect(machine.queue[0]?.remaining).toBe(1);
    machine.energySeconds = 12;
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 12);
    expect(machine.output.plate).toBe(2);
    expect(machine.queue).toEqual([]);
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 12);
    expect(machine.output.plate).toBe(2);
  });
  it("saída cheia não perde produto nem duplica energia/recursos ao retomar", () => {
    const { g, data, terrain, machine } = setup();
    machine.input = { iron: 3 };
    enqueueFacility(data, "0,28", "plate", 1);
    machine.output = { wood: 99 * FACILITY_SLOTS };
    machine.energySeconds = 12;
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 12);
    expect(machine.queue).toHaveLength(1);
    expect(machine.blocked).toBe(true);
    machine.output = {};
    advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 0);
    expect(machine.output.plate).toBe(1);
    expect(machine.queue).toHaveLength(0);
  });
  it("rejeita filas inválidas e desmontagem com conteúdo", () => {
    const { g, data, terrain, machine } = setup();
    machine.input = { iron: 3 };
    expect(enqueueFacility(data, "0,28", "fake", 1)).toBeTruthy();
    expect(enqueueFacility(data, "0,28", "plate", NaN)).toBeTruthy();
    expect(enqueueFacility(data, "0,28", "plate", 101)).toBeTruthy();
    expect(machine.input.iron).toBe(3);
    expect(
      removePiece(
        {
          terrain,
          settlement: data,
          inventory: g.state.backpack,
          capacity: 24,
          player: g.state.player,
          landingX: 100,
        },
        0,
        28,
      ),
    ).toContain("Esvazie");
  });
  it("instalação larga precisa de chão nas duas colunas e espaço de altura", () => {
    const { g, data, terrain } = setup();
    delete data.pieces["0,28"];
    vi.spyOn(terrain, "getAt").mockImplementation((_x, y) => (y >= 29 ? 1 : 0));
    g.state.backpack.geoProbe = 1;
    g.state.player.x = 90;
    expect(
      placePiece(
        {
          terrain,
          settlement: data,
          inventory: g.state.backpack,
          capacity: 24,
          player: g.state.player,
          landingX: 100,
        },
        "geoProbe",
        0,
        28,
      ),
    ).toBeUndefined();
    expect(pieceAt(data, 1, 27)?.piece.kind).toBe("geoProbe");
  });
  it("máquinas disputam a mesma bateria sem duplicar energia", () => {
    const { data, terrain } = setup();
    vi.spyOn(terrain, "getAt").mockReturnValue(0);
    data.pieces["3,28"] = { kind: "planetRefinery", facing: 1 };
    data.pieces["6,28"] = { kind: "battery", facing: 1, energy: 3 };
    for (const key of ["0,28", "3,28"]) {
      machineAt(data, key)!.input = { iron: 3 };
      enqueueFacility(data, key, "plate", 1);
    }
    advancePowerNetwork(data, powerNetwork(terrain, data), 0, 1, true);
    expect(data.pieces["6,28"]!.energy).toBe(0);
    expect(
      (data.machines?.["0,28"]?.energySeconds ?? 0) +
        (data.machines?.["3,28"]?.energySeconds ?? 0),
    ).toBeCloseTo(1);
  });
  it("solar desliga à noite e teto impede os instrumentos externos", () => {
    const { data, terrain, machine } = setup("observatory");
    vi.spyOn(terrain, "getAt").mockReturnValue(0);
    data.pieces["3,28"] = { kind: "solarPanel", facing: 1 };
    enqueueFacility(data, "0,28", "scan", 1);
    let network = powerNetwork(terrain, data);
    advancePowerNetwork(data, network, 0, 1, true);
    expect(machine.energySeconds).toBeCloseTo(1);
    machine.energySeconds = 0;
    advancePowerNetwork(data, network, 450, 451, true);
    expect(machine.energySeconds).toBe(0);
    data.pieces["0,26"] = { kind: "woodBlock", facing: 1 };
    network = powerNetwork(terrain, data);
    advancePowerNetwork(data, network, 0, 1, true);
    expect(machine.energySeconds).toBe(0);
    expect(data.pieces["0,28"]?.powered).toBe(false);
  });
  it("observatório não cataloga nem concede crédito ao revelar pistas", () => {
    const { g } = setup("observatory");
    const before = JSON.stringify(g.state.progression.discoveries);
    const cr = g.state.credits;
    observatoryClues(g.state, g.system);
    expect(JSON.stringify(g.state.progression.discoveries)).toBe(before);
    expect(g.state.credits).toBe(cr);
  });
  it("sonda encontra depósitos reais e respeita os já minerados", () => {
    const { terrain } = setup("geoProbe");
    vi.spyOn(terrain, "getAt").mockImplementation((x, y, z) =>
      x === 2 && y === 32 && z === 1 ? 6 : 0,
    );
    expect(geologicalDeposits(terrain, "0,28")).toEqual([
      expect.objectContaining({ name: "Titânio", x: 40, y: 520, z: 16 }),
    ]);
    vi.mocked(terrain.getAt).mockReturnValue(0);
    expect(geologicalDeposits(terrain, "0,28")).toEqual([]);
  });
  it("análises repetidas geram dados de menor valor sem conceder CR diretamente", () => {
    const { g, data, terrain, machine } = setup("sampleLab");
    machine.input = { iron: 2 };
    enqueueFacility(data, "0,28", "iron", 2);
    const credits = g.state.credits;
    for (let i = 0; i < 2; i++) {
      machine.energySeconds = 20;
      advanceFacility(g.state, g.planet, g.system, terrain, "0,28", 20);
    }
    const samples = Object.values(g.state.progression.discoveries).filter((d) =>
      d.id.startsWith("sample:"),
    );
    expect(samples).toHaveLength(2);
    expect(samples[0]!.credits).toBeGreaterThan(samples[1]!.credits);
    expect(g.state.credits).toBe(credits);
    g.state.mode = "docked";
    expect(sellScience(g.state, samples[0]!.id)).toBeUndefined();
    expect(sellScience(g.state, samples[0]!.id)).toBeTruthy();
  });
  it("fragmento de ruína só é recolhido uma vez e pode ser recuperado se mochila estava cheia", () => {
    const { g } = setup();
    g.state.backpack = { wood: 99 * 24 };
    const site = {
      id: "ruin:test",
      kind: "ruin" as const,
      name: "Ruína",
      x: g.state.player.x,
      y: g.state.player.y,
      level: 1,
      credits: 200,
    };
    expect(scanSite(g.state, g.system, site)).toBe(true);
    expect(g.state.backpack.ruinFragment).toBeUndefined();
    g.state.backpack = {};
    expect(scanSite(g.state, g.system, site)).toBe(true);
    expect(g.state.backpack.ruinFragment).toBe(1);
    expect(scanSite(g.state, g.system, site)).toBe(false);
  });
  it("previsão usa o mesmo ciclo da precipitação", () => {
    const planet = systemAt("VOIDBOUND", 0, 0).planets.find((p) =>
      forecastWeather(p, 0),
    );
    expect(planet).toBeTruthy();
    if (!planet) return;
    const prediction = forecastWeather(planet, 0)!;
    expect(weatherAt(planet, prediction.seconds + 1)?.kind).toBe(
      prediction.kind,
    );
  });
  it("coletor transforma chuva, neve e ácido em produtos distintos", () => {
    for (const [kind, item] of [
      ["rain", "water"],
      ["snow", "ice"],
      ["acid", "acidResidue"],
    ] as const) {
      let planet;
      for (let i = 0; i < 100 && !planet; i++)
        planet = systemAt("collector", i, 0).planets.find(
          (p) => forecastWeather(p, 0)?.kind === kind,
        );
      expect(planet).toBeTruthy();
      if (!planet) continue;
      const { g, data, terrain, machine } = setup("climateCollector");
      g.state.settlements[planet.id] = data;
      g.state.time = forecastWeather(planet, 0)!.seconds + 10;
      machine.energySeconds = 10;
      advanceFacility(g.state, planet, g.system, terrain, "0,28", 10);
      expect(machine.output[item]).toBe(1);
    }
  });
  it("processa uma instalação remota usando o mesmo tempo e energia reais", () => {
    const { g, data, machine } = setup();
    machine.input = { iron: 3 };
    enqueueFacility(data, "0,28", "plate", 1);
    data.pieces["4,28"] = { kind: "battery", facing: 1, energy: 50 };
    data.utilityTime = 0;
    g.state.mode = "space";
    g.state.systemX = 1;
    const system = new FacilitySystem();
    for (let i = 1; i <= 12; i++) {
      g.state.time = i;
      system.step(g.state, 1, 0);
    }
    expect(machine.output.plate).toBe(1);
    expect(data.pieces["4,28"]?.energy).toBeCloseTo(14);
    expect(machine.queue).toEqual([]);
  });
  it("atualização passiva de habitat não transforma sono em progresso industrial", () => {
    const { data, machine, terrain } = setup();
    vi.spyOn(terrain, "getAt").mockReturnValue(0);
    machine.input = { iron: 3 };
    enqueueFacility(data, "0,28", "plate", 1);
    data.pieces["4,28"] = { kind: "battery", facing: 1, energy: 50 };
    advancePowerNetwork(data, powerNetwork(terrain, data), 0, 300);
    expect(machine.energySeconds ?? 0).toBe(0);
    expect(data.pieces["4,28"]?.energy).toBe(50);
  });
  it("meteorológica energizada alerta uma vez antes de um evento perigoso", () => {
    const { g, data } = setup("weatherStation");
    let found = false;
    for (let x = 0; x < 30 && !found; x++) {
      const system = systemAt(g.state.seed, x, 0);
      for (let index = 0; index < system.planets.length && !found; index++) {
        const planet = system.planets[index]!,
          forecast = forecastWeather(planet, 0);
        if (!forecast || forecast.kind === "rain") continue;
        g.state.systemX = x;
        g.state.planetIndex = index;
        g.state.settlements = { [planet.id]: data };
        g.state.changes[planet.id] = Object.fromEntries(
          Array.from({ length: 29 }, (_, y) => [`0,${y}`, 0]),
        );
        data.pieces["4,28"] = { kind: "battery", facing: 1, energy: 100 };
        g.state.time = forecast.seconds - 15;
        data.utilityTime = g.state.time - 1;
        const facilities = new FacilitySystem();
        expect(facilities.step(g.state, 1, 0)).toHaveLength(1);
        g.state.time++;
        expect(facilities.step(g.state, 1, 0)).toHaveLength(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it("produção persiste em save/load sem processar tempo de relógio offline", async () => {
    const { g, data, machine } = setup();
    machine.input = { iron: 3 };
    enqueueFacility(data, "0,28", "plate", 1);
    machine.queue[0]!.progress = 5;
    const db = new SaveDatabase("facility-save-test");
    try {
      await db.write(g.state);
      const restored = migrateSave((await db.localSlot())!.data);
      expect(restored.settlements[g.planet.id]?.machines).toEqual(
        data.machines,
      );
      new FacilitySystem().step(restored, 0, 0);
      expect(
        restored.settlements[g.planet.id]?.machines?.["0,28"]?.queue[0]
          ?.progress,
      ).toBe(5);
    } finally {
      await db.delete();
    }
  });
});
