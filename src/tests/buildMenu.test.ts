import { describe, expect, it } from "vitest";
import {
  buildCategories,
  buildCategory,
  buildDescriptions,
  constructionRecipes,
  canBuild,
  filterBuildRecipes,
  type BuildFilters,
} from "../construction/menu";
import { buildItems } from "../construction/building";
import type { Inventory } from "../game/types";
const defaults: BuildFilters = {
  search: "",
  category: "all",
  ready: false,
  owned: false,
  sort: "name",
};
describe("catálogo de construções", () => {
  it("inclui todos os projetos com categoria, descrição e receita", () => {
    expect(constructionRecipes.map((r) => r.id)).toEqual(buildItems);
    for (const recipe of constructionRecipes) {
      expect(buildCategories[buildCategory(recipe.id)]).toBeTruthy();
      expect(buildDescriptions[recipe.id]).toBeTruthy();
      expect(recipe.station).toBe("hand");
    }
  });
  it("busca ignora acentos e caixa e também encontra ingredientes", () => {
    expect(
      filterBuildRecipes({}, { ...defaults, search: "METEOROLOGICA" }).some(
        (r) => r.id === "weatherStation",
      ),
    ).toBe(true);
    expect(
      filterBuildRecipes({}, { ...defaults, search: "titanio" }).some(
        (r) => r.id === "planetRefinery",
      ),
    ).toBe(true);
    expect(
      filterBuildRecipes({}, { ...defaults, category: "science" })
        .map((r) => r.id)
        .sort(),
    ).toEqual(
      ["geoProbe", "observatory", "sampleLab", "weatherStation"].sort(),
    );
  });
  it("combina filtros por categoria, posse e possibilidade de fabricar", () => {
    expect(
      filterBuildRecipes(
        { cabinetDouble: 1 },
        { ...defaults, owned: true },
      ).map((r) => r.id),
    ).toEqual(["cabinetDouble"]);
    expect(
      filterBuildRecipes(
        { wood: 2 },
        { ...defaults, category: "structure", ready: true },
      ).map((r) => r.id),
    ).toContain("woodBlock");
    expect(
      filterBuildRecipes(
        { wood: 2 },
        { ...defaults, category: "science", ready: true },
      ),
    ).toEqual([]);
  });
  it("fabricável considera espaço e não muda inventário nem metadados", () => {
    const recipe = constructionRecipes.find((r) => r.id === "woodBlock")!;
    const inventory: Inventory = { wood: 99 * 24 };
    const original = JSON.stringify(inventory);
    expect(canBuild(recipe, inventory, 0, 24)).toBe(false);
    expect(JSON.stringify(inventory)).toBe(original);
    expect(canBuild(recipe, { wood: 2 }, 0, 24)).toBe(true);
  });
  it("ordena por quantidade e fornece estado vazio correto", () => {
    const list = filterBuildRecipes(
      { woodBlock: 10, cabinet: 2 },
      { ...defaults, sort: "owned" },
    );
    expect(list[0]!.id).toBe("woodBlock");
    expect(
      filterBuildRecipes(
        {},
        { ...defaults, search: "não existe esta construção" },
      ),
    ).toEqual([]);
  });
});
