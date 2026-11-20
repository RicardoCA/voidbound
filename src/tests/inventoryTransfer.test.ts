import { describe, expect, it } from "vitest";
import { transferable, transferList } from "../inventory/transfer";
import { transfer } from "../construction/building";
import type { Inventory } from "../game/types";

describe("transferências de inventários", () => {
  it("calcula o que cabe incluindo pilha parcial com slots cheios", () => {
    expect(transferable({ wood: 40 }, { iron: 99, wood: 90 }, "wood", 2)).toBe(
      9,
    );
    expect(transferable({ wood: 40 }, { iron: 99 }, "wood", 1)).toBe(0);
    expect(transferable({ wood: 40 }, {}, "wood", 1, 10)).toBe(10);
    expect(transferable({ wood: 40 }, {}, "wood", 1, NaN)).toBe(0);
  });
  it("guardar semelhantes só considera os itens originalmente presentes", () => {
    expect(
      transferList({ iron: 20, wood: 30, copper: 0 }, { wood: 1 }, true),
    ).toEqual([["wood", 30]]);
    expect(transferList({ iron: 20 }, {}, true)).toEqual([]);
  });
  it.each([16, 32, 48])(
    "transfere o que couber em %i slots sem perder ou duplicar itens",
    (capacity) => {
      const source: Inventory = { wood: 200, iron: 100 };
      const destination: Inventory = { copper: 99 * (capacity - 1), wood: 90 };
      const n = transferable(source, destination, "wood", capacity);
      expect(n).toBe(9);
      expect(transfer(source, destination, "wood", n, capacity)).toBe(true);
      expect(source.wood).toBe(191);
      expect(destination.wood).toBe(99);
      expect(transferable(source, destination, "iron", capacity)).toBe(0);
      expect((source.wood ?? 0) + (destination.wood ?? 0)).toBe(290);
    },
  );
  it("não permite transferir para o próprio inventário", () => {
    const inventory: Inventory = { wood: 10 };
    expect(transferable(inventory, inventory, "wood", 24)).toBe(0);
  });
});

import { filterInventory, itemCategory } from "../inventory/presentation";
describe("organização da mochila", () => {
  it("busca sem acentos, ignora metadados e ordena por quantidade", () => {
    expect(
      filterInventory(
        { silicon: 3, wood: 12, iron: 0 },
        "silicio",
        "all",
        "name",
      ),
    ).toEqual([["silicon", 3]]);
    expect(
      filterInventory({ silicon: 3, wood: 12 }, "", "all", "quantity"),
    ).toEqual([
      ["wood", 12],
      ["silicon", 3],
    ]);
  });
  it("separa alimentos, construções, equipamentos e materiais", () => {
    expect(itemCategory("rawMeat")).toBe("food");
    expect(itemCategory("woodWall")).toBe("building");
    expect(itemCategory("repair")).toBe("equipment");
    expect(itemCategory("oxygenCartridge")).toBe("equipment");
    expect(itemCategory("iron")).toBe("materials");
    expect(
      filterInventory(
        { iron: 4, cookedMeat: 2, woodWall: 1 },
        "",
        "food",
        "name",
      ),
    ).toEqual([["cookedMeat", 2]]);
  });
});
