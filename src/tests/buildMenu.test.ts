import { describe, expect, it } from "vitest";
import {
  buildCategories, buildCategory, buildDescriptions, filterBuildItems, type BuildFilters,
} from "../construction/menu";
import { buildItems } from "../construction/building";
import { recipes } from "../crafting/recipes";

const defaults: BuildFilters = { search: "", category: "all", owned: false, sort: "name" };

describe("catálogo de construções", () => {
  it("lista todas as peças e mantém suas receitas nas bancadas", () => {
    expect(filterBuildItems({}, defaults)).toHaveLength(buildItems.length);
    for (const id of buildItems) {
      expect(buildCategories[buildCategory(id)]).toBeTruthy();
      expect(buildDescriptions[id]).toBeTruthy();
      expect(recipes.find(recipe => recipe.id === id)?.station).toBe("bench");
    }
  });

  it("busca sem acentos e combina categoria, posse e ordenação", () => {
    expect(filterBuildItems({}, { ...defaults, search: "METEOROLOGICA" })).toContain("weatherStation");
    expect(filterBuildItems({ cabinetDouble: 1, cabinet: 2, woodBlock: 10 }, {
      ...defaults, category: "storage", owned: true, sort: "owned",
    })).toEqual(["cabinet", "cabinetDouble"]);
    expect(filterBuildItems({}, { ...defaults, search: "não existe esta construção" })).toEqual([]);
  });
});
