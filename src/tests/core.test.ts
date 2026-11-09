import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { setActivePinia, createPinia } from "pinia";
import { deflectorFor, starKinds } from "../universe/stars";
import { systemAt, nearby } from "../universe/generator";
import { Terrain } from "../game/procedural/terrain";
import { LRU, random } from "../game/procedural/random";
import { add, consume, slots } from "../inventory/inventory";
import { craft, recipes } from "../crafting/recipes";
import { SaveDatabase } from "../persistence/database";
import { useGame } from "../stores/game";
import type { Inventory } from "../game/types";
import { audio } from "../game/systems/audio";
audio.enabled = false;
beforeEach(() => setActivePinia(createPinia()));
describe("Universo determinístico e limitado em memória", () => {
  it("reproduz sistemas depois da expulsão do cache", () => {
    const original = structuredClone(systemAt("same", 12, -400));
    for (let i = 0; i < 80; i++) systemAt("other", i, 300);
    expect(systemAt("same", 12, -400)).toEqual(original);
    expect(systemAt("other", 12, -400)).not.toEqual(original);
  });
  it("gera entre 1 e 8 planetas e todos os seis biomas", () => {
    const kinds = new Set<number>();
    for (let x = 0; x < 60; x++) {
      const sys = systemAt("universe", x, 5);
      expect(sys.planets.length).toBeGreaterThanOrEqual(1);
      expect(sys.planets.length).toBeLessThanOrEqual(8);
      sys.planets.forEach((p) => kinds.add(p.kind));
    }
    expect(kinds.size).toBe(6);
    expect(nearby("u", 0, 0).some((s) => s.x === 0 && s.y === 0)).toBe(true);
  });
  it("expulsa a entrada menos recente no LRU", () => {
    const cache = new LRU<number, string>(2);
    cache.set(1, "a");
    cache.set(2, "b");
    cache.get(1);
    cache.set(3, "c");
    expect(cache.get(2)).toBeUndefined();
    expect(cache.size).toBe(2);
  });
  it("mantém a sequência de números aleatórios", () => {
    const a = random(42),
      b = random(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("reproduz terreno, coordenadas negativas e diferenças sem expandir cache", () => {
    const p = systemAt("test", 0, 0).planets[0]!,
      changes: Record<string, number> = {},
      a = new Terrain(p, changes),
      b = new Terrain(p, {});
    for (let x = -80; x < 80; x++)
      for (let y = 0; y < 64; y++) expect(a.get(x, y)).toBe(b.get(x, y));
    const h = a.height(-1);
    expect(a.get(-1, h)).not.toBe(0);
    a.remove(-1, h);
    expect(new Terrain(p, changes).get(-1, h)).toBe(0);
    expect(b.get(-1, h)).not.toBe(0);
    for (let x = -80; x < 80; x++) a.chunk(x);
    expect(a.cachedChunks).toBeLessThanOrEqual(12);
  });
});
describe("Inventário e fabricação transacionais", () => {
  it("recusa quantidades inválidas e consumo parcial", () => {
    const inv: Inventory = { iron: 3 };
    expect(add(inv, "copper", 0)).toBe(false);
    expect(consume(inv, { iron: 2, copper: 1 })).toBe(false);
    expect(inv).toEqual({ iron: 3 });
    expect(consume(inv, { iron: -1 })).toBe(false);
  });
  it("conta pilhas e impede perda por capacidade", () => {
    const inv: Inventory = { iron: 99 };
    expect(add(inv, "iron", 1, 1)).toBe(false);
    expect(inv.iron).toBe(99);
    expect(add(inv, "copper", 99, 2)).toBe(true);
    expect(slots(inv)).toBe(2);
  });
  it("fabrica com consumo exato e desbloqueio", () => {
    const inv: Inventory = { iron: 6, copper: 2, silicon: 1 };
    expect(craft(inv, recipes[0]!, 24, 0)).toBe(true);
    expect(inv).toEqual({ iron: 3, copper: 2, silicon: 1, plate: 1 });
    expect(
      craft(
        inv,
        recipes.find((r) => r.id === "jump")!,
        24,
        0,
      ),
    ).toBe(false);
  });
  it("reverte receita quando saída não cabe", () => {
    const inv: Inventory = { iron: 4, copper: 99 };
    const before = { ...inv };
    expect(craft(inv, recipes[0]!, 2, 0)).toBe(false);
    expect(inv).toEqual(before);
  });
});
describe("Progressão e salvamento", () => {
  it("completa o ciclo pousar, minerar, craftar, reparar e decolar sem perder carga", () => {
    const g = useGame();
    g.newGame("vertical");
    g.orbit(0);
    g.land(0);
    g.exit();
    expect(g.state.mode).toBe("surface");
    g.collect("iron", 6);
    g.collect("copper", 4);
    g.collect("silicon", 2);
    expect(g.state.mission).toBe(2);
    g.enter();
    expect(g.moveCargo(true, "iron", 6)).toBe(true);
    expect(g.moveCargo(true, "copper", 4)).toBe(true);
    expect(g.moveCargo(true, "silicon", 2)).toBe(true);
    g.make("plate");
    g.make("plate");
    g.make("circuit");
    g.make("circuit");
    g.make("repair");
    expect(g.state.mission).toBe(3);
    g.takeoff();
    expect(g.state.mode).toBe("interior");
    g.use("repair");
    expect(g.state.ship.hull).toBe(100);
    const cargo = { ...g.state.inventory };
    g.takeoff();
    expect(g.state.mode).toBe("space");
    expect(g.state.mission).toBe(4);
    expect(g.state.inventory).toEqual(cargo);
  });
  it("não fabrica fora da nave ou instala melhoria duplicada", () => {
    const g = useGame();
    g.newGame("s");
    g.state.inventory = { iron: 10, engine: 2 };
    g.make("plate");
    expect(g.state.inventory.iron).toBe(10);
    g.state.mode = "interior";
    g.use("engine");
    g.use("engine");
    expect(g.state.upgrades).toEqual(["engine"]);
    expect(g.state.inventory.engine).toBe(1);
    expect(g.jumpRange).toBe(4);
  });
  it("recuperação solar evita bloqueio de combustível", () => {
    const g = useGame();
    g.newGame("s");
    g.state.mode = "interior";
    g.state.ship.fuel = 0;
    g.recover();
    expect(g.state.ship.fuel).toBe(5);
    expect(g.state.time).toBe(60);
  });
  it("mantém progresso e modificações após fechar e reabrir IndexedDB", async () => {
    const name = `test-${Date.now()}`,
      g = useGame();
    g.newGame("persist");
    g.state.inventory = { iron: 17, crystal: 3 };
    g.state.changes[g.planet.id] = { "-12,30": 0 };
    g.state.ship.x = -123.5;
    g.state.upgrades = ["engine"];
    const db = new SaveDatabase(name);
    await db.write(g.state);
    db.close();
    const reopened = new SaveDatabase(name),
      saved = await reopened.read();
    expect(saved).toEqual(JSON.parse(JSON.stringify(g.state)));
    await reopened.delete();
  });
  it("sobrevivência consome oxigênio e resgata na nave", () => {
    const g = useGame();
    g.newGame("s");
    g.state.mode = "surface";
    g.state.player.oxygen = 0;
    g.state.player.health = 1;
    g.tick(1);
    expect(g.state.mode).toBe("interior");
    expect(g.state.player.health).toBe(100);
  });
});

describe("Salto interestelar e controles de toque", () => {
  it("viaja apenas com propulsor, alcance e combustível, preservando a carga", async () => {
    const g = useGame();
    g.newGame("jump");
    g.state.inventory = { iron: 9 };
    const fuel = g.state.ship.fuel;
    await g.jump(1, 0);
    expect(g.state.systemX).toBe(0);
    g.state.upgrades = ["jump"];
    await g.jump(3, 0);
    expect(g.state.systemX).toBe(0);
    await g.jump(1, 0);
    expect(g.state.systemX).toBe(1);
    expect(g.state.ship.fuel).toBe(fuel - 8);
    expect(g.state.inventory).toEqual({ iron: 9 });
    expect(g.state.visited).toContain("jump:1:0");
    expect(g.system.planets[0]!.id).not.toBe("jump:0:0:p0");
  }, 10_000);
  it("preserva um toque rápido até o próximo frame", async () => {
    const { controls, pressControl, takePulse, releaseControls } =
      await import("../game/input");
    pressControl("interact");
    controls.interact = false;
    expect(takePulse("interact")).toBe(true);
    expect(takePulse("interact")).toBe(false);
    pressControl("mine");
    releaseControls();
    expect(takePulse("mine")).toBe(false);
  });
});

describe("estrelas e defletores térmicos", () => {
  it("gera sistemas simples, binários e triplos com todas as classes e chegada segura", () => {
    const kinds = new Set<string>();
    const counts = new Set<number>();
    for (let x = 0; x < 240; x++) {
      const stars = systemAt("star-check", x, -4).stars;
      counts.add(stars.length);
      for (const star of stars) {
        kinds.add(star.kind);
        expect(Math.hypot(star.x - 200, star.y - 330)).toBeGreaterThan(205);
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect([...kinds].sort()).toEqual([...starKinds].sort());
  });

  it("só protege contra a classe do defletor equipado na nave", () => {
    const g = useGame();
    g.newGame("heat");
    const star = g.system.stars[0]!;
    const item = deflectorFor(star.kind);
    g.state.ship.hull = 100;
    expect(g.applyStellarHeat(1)).toBe(false);
    expect(g.state.ship.hull).toBe(100);
    Object.assign(g.state.ship, { x: star.x, y: star.y });
    g.state.upgrades = ["shield", "deflector-neutron"];
    g.applyStellarHeat(1);
    expect(g.state.ship.hull).toBe(88);
    g.state.mode = "interior";
    g.state.inventory = { plate: 3, circuit: 2, cell: 1 };
    g.make(item);
    expect(g.state.inventory[item]).toBe(1);
    g.use(item);
    expect(g.state.inventory[item]).toBeUndefined();
    g.state.mode = "space";
    g.applyStellarHeat(1);
    expect(g.state.ship.hull).toBe(88);
    expect(g.stellarWarning?.protectedByDeflector).toBe(true);
  });

  it("usa o resgate de sobrevivência e afasta a Sparrow da estrela", () => {
    const g = useGame();
    g.newGame("rescue-heat");
    const star = g.system.stars[0]!;
    g.state.inventory = { iron: 1 };
    g.state.backpack = { stone: 2 };
    Object.assign(g.state.ship, { x: star.x, y: star.y, hull: 1 });
    expect(g.applyStellarHeat(1)).toBe(true);
    expect(g.state.ship.hull).toBe(30);
    expect(g.stellarWarning).toBeUndefined();
    expect(g.state.inventory).toEqual({});
    expect(g.state.backpack).toEqual({});
  });
});
