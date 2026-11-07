import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "../stores/game";
import { useBases } from "../stores/bases";
import { settlementFor } from "../construction/building";
import { groupBases, listBases, planetAddress } from "../construction/catalog";
import { nearestLanding } from "../universe/landings";
import { systemAt } from "../universe/generator";
import { SaveDatabase } from "../persistence/database";
import { audio } from "../game/systems/audio";
audio.enabled = false;
beforeEach(() => setActivePinia(createPinia()));
function setup() {
  const g = useGame();
  g.newGame("world:seed:0");
  const planet = g.planet,
    data = settlementFor(g.state, planet.id);
  return { g, planet, data };
}
describe("Catálogo de bases e depósitos", () => {
  it("recupera coordenadas negativas e seeds que contêm dois pontos", () => {
    expect(planetAddress("world:seed:0", "world:seed:0:-12:43:p3")).toEqual({
      x: -12,
      y: 43,
      planetIndex: 3,
    });
    expect(
      planetAddress("different", "world:seed:0:-12:43:p3"),
    ).toBeUndefined();
    expect(planetAddress("u", "u:1:2:p8")).toBeUndefined();
    expect(planetAddress("u", "u:9007199254740992:2:p0")).toBeUndefined();
  });
  it("soma os itens de armários reais, distinguindo armário vazio e casa sem depósito", () => {
    const { g, data } = setup();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 20, iron: 7 };
    data.pieces["28,29"] = { kind: "cabinet", facing: 1 };
    data.cabinets["28,29"] = { wood: 8 };
    data.pieces["50,29"] = { kind: "cabinet", facing: 1 };
    data.cabinets["50,29"] = {};
    data.walls["5,28"] = true;
    const base = listBases(g.state)[0]!;
    expect(base.inventory).toEqual({ wood: 28, iron: 7 });
    expect(base.units).toBe(35);
    expect(base.occupiedCabinets).toBe(2);
    expect(base.cabinets).toHaveLength(3);
    expect(base.cabinets[0]!.usedSlots).toBe(2);
    expect(base.walls).toBe(1);
    expect(base.system.name).toBe(g.system.name);
    expect(base.planet.name).toBe(g.planet.name);
  });
  it("não inventa base para árvores cortadas nem conta inventário órfão de armário desmontado", () => {
    const { g, data } = setup();
    data.cutTrees = ["tree:0"];
    data.cabinets["8,28"] = { iron: 100 };
    expect(listBases(g.state)).toEqual([]);
    data.pieces["4,28"] = { kind: "woodBlock", facing: 1 };
    expect(listBases(g.state)[0]!.units).toBe(0);
    expect(listBases(g.state)[0]!.cabinets).toEqual([]);
  });
  it("separa depósitos de planetas e sistemas diferentes e gera marcadores agregados", () => {
    const { g, data } = setup();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 5 };
    const other = systemAt(g.state.seed, -8, 17).planets[0]!,
      second = settlementFor(g.state, other.id);
    second.pieces["-5,28"] = { kind: "cabinet", facing: 1 };
    second.cabinets["-5,28"] = { copper: 12 };
    const rows = listBases(g.state),
      groups = groupBases(rows);
    expect(rows[0]!.planet.id).toBe(other.id);
    expect(groups.get(g.system.id)!.units).toBe(5);
    expect(groups.get(`${g.state.seed}:-8:17`)!.units).toBe(12);
    expect(groups.size).toBe(2);
  });
  it("é uma consulta sem mutação e não permite retirar itens remotamente", () => {
    const { g, data } = setup();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 8 };
    const snapshot = JSON.stringify(g.state),
      report = listBases(g.state);
    report[0]!.inventory.wood = 999;
    report[0]!.cabinets[0]!.inventory.wood = 777;
    expect(JSON.stringify(g.state)).toBe(snapshot);
    expect(data.cabinets["4,28"]!.wood).toBe(8);
  });
  it("atualiza totais após depositar, esvaziar e desmontar armários", () => {
    const { data } = setup(),
      bases = useBases();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 3 };
    expect(bases.totalUnits).toBe(3);
    expect(bases.storedPlanets).toBe(1);
    data.cabinets["4,28"]!.wood = 0;
    expect(bases.totalUnits).toBe(0);
    expect(bases.storedPlanets).toBe(0);
    expect(bases.all[0]!.cabinets).toHaveLength(1);
    delete data.pieces["4,28"];
    delete data.cabinets["4,28"];
    expect(bases.all).toEqual([]);
  });
  it("escolhe a zona de pouso mais próxima e mantém coordenadas exatas do armário", () => {
    expect(nearestLanding(-200).id).toBe(0);
    expect(nearestLanding(30).id).toBe(1);
    expect(nearestLanding(900).id).toBe(2);
    const { g, data } = setup();
    data.pieces["-200,29"] = { kind: "cabinet", facing: 1 };
    data.cabinets["-200,29"] = { iron: 2 };
    const cabinet = listBases(g.state)[0]!.cabinets[0]!;
    expect([cabinet.x, cabinet.y]).toEqual([-200, 29]);
    expect(cabinet.landing.name).toBe("Planície de Aurora");
  });
  it("reconstrói o catálogo depois de fechar e abrir IndexedDB sem uma nova versão de save", async () => {
    const { g, data } = setup();
    data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
    data.cabinets["4,28"] = { wood: 19 };
    const expected = listBases(g.state),
      name = `catalog-${crypto.randomUUID()}`,
      db = new SaveDatabase(name);
    await db.write(g.state);
    db.close();
    const reopened = new SaveDatabase(name),
      saved = await reopened.read();
    expect(saved!.version).toBe(4);
    expect(listBases(saved!)).toEqual(expected);
    await reopened.delete();
  });
});

it("não mistura a carga da nave com os itens guardados nos planetas", () => {
  const { g, data } = setup();
  g.state.inventory = { wood: 999, iron: 50 };
  data.pieces["4,28"] = { kind: "cabinet", facing: 1 };
  data.cabinets["4,28"] = { wood: 5 };
  expect(listBases(g.state)[0]!.inventory).toEqual({ wood: 5 });
  expect(listBases(g.state)[0]!.units).toBe(5);
});
