import { items, type BuildItem, type Inventory } from "../game/types";
import { recipes, craft, type Recipe } from "../crafting/recipes";
import { buildItems } from "./building";
import { facilityDefinitions, type FacilityKind } from "./facilityTypes";
import { inventoryEntries } from "../inventory/inventory";
export const buildCategories = {
  all: "Todos",
  structure: "Estrutura",
  openings: "Portas e janelas",
  storage: "Armazenamento",
  energy: "Energia e oxigênio",
  lighting: "Iluminação",
  production: "Produção",
  science: "Ciência",
  furniture: "Móveis",
} as const;
export type BuildCategory = keyof typeof buildCategories;
const categories: Record<BuildItem, Exclude<BuildCategory, "all">> = {
  woodBlock: "structure",
  woodWall: "structure",
  stoneWall: "structure",
  metalWall: "structure",
  woodStairs: "structure",
  stickLadder: "structure",
  woodDoor: "openings",
  woodHatch: "openings",
  window: "openings",
  airlockDoor: "openings",
  cabinet: "storage",
  cabinetDouble: "storage",
  cabinetTriple: "storage",
  fridge: "storage",
  solarPanel: "energy",
  battery: "energy",
  oxygenGenerator: "energy",
  planetaryOxygenGenerator: "energy",
  floodlight: "lighting",
  emergencyLight: "lighting",
  workbench: "production",
  campfire: "production",
  planetRefinery: "production",
  climateCollector: "production",
  observatory: "science",
  geoProbe: "science",
  weatherStation: "science",
  sampleLab: "science",
  picture: "furniture",
  table: "furniture",
  bed: "furniture",
};
export function buildCategory(id: BuildItem) {
  return categories[id];
}
export const buildDescriptions: Record<BuildItem, string> = {
  ...(Object.fromEntries(
    Object.entries(facilityDefinitions).map(([id, spec]) => [
      id,
      spec.description,
    ]),
  ) as Record<FacilityKind, string>),
  stoneWall: "Parede de fundo feita de pedra minerada em planetas rochosos.",
  metalWall: "Parede de fundo feita de placas metálicas.",
  fridge:
    "Guarda carne crua em 16 slots. Precisa de energia de placas solares ou baterias próximas para refrigerar.",
  picture: "Decoração. Instale em uma parede de fundo.",
  table: "Mesa decorativa. Instale sobre chão firme.",
  bed: "Use E ou toque para dormir e avançar 8 horas locais.",
  woodBlock: "Piso, fundação, pilares e telhado. Bloco sólido.",
  woodWall: "Fundo da casa. Você pode andar à frente da parede.",
  woodStairs: "Degraus que você sobe caminhando. Inverta a direção com R.",
  stickLadder:
    "Empilhe na vertical. Use E ou toque para se apoiar. Suba e desça com W/S, setas ou os controles de movimento.",
  woodHatch:
    "Instale no piso acima da escada. Use E ou toque para abrir e passar entre andares.",
  cabinet:
    "16 slots de armazenamento exclusivo deste planeta. E ou toque abre.",
  cabinetDouble:
    "Ocupa 2 blocos de largura e guarda 32 slots. E ou toque abre.",
  cabinetTriple:
    "Ocupa 3 blocos de largura e guarda 48 slots. E ou toque abre.",
  workbench:
    "Ocupa 2 blocos de largura. Instale sobre chão firme e interaja para fabricar itens usando apenas os materiais da mochila. Não acessa a carga da nave nem os armários.",
  floodlight:
    "Ilumina de verdade o terreno. Instale sobre chão firme e gire para apontar. Usa 2 de energia/s de placas expostas ou baterias a até 12 blocos.",
  emergencyLight:
    "Instale junto à saída. Carrega sua reserva na rede a até 12 blocos; sem energia, acende automaticamente. A reserva cheia dura 20 minutos ativos. Recarga completa: 2 minutos de alimentação. Instale e carregue antes de usar.",
  window:
    "Vidro transparente e vedado. Instale em um vão sem parede nem bloco de madeira. Use Girar para alinhar ao cômodo.",
  airlockDoor:
    "Monte duas portas alinhadas, separadas por 1 a 5 blocos, no mesmo piso, cercando uma câmara vedada. Ao abrir uma, a parceira fecha. A sala principal permanece pressurizada.",
  woodDoor:
    "Ocupa 1 × 2 blocos. E, Int. ou toque para abrir/fechar. Fecha a vedação da casa.",
  solarPanel:
    "Coloque sobre piso ou teto, com céu livre acima. Carrega a bateria mais próxima até 12 blocos; sem bateria, alimenta o gerador diretamente.",
  campfire:
    "Instale sobre chão firme. Use E ou toque na fogueira para assar carne crua.",
  battery:
    "Armazena até 1.200 de energia solar e alimenta o gerador mais próximo até 12 blocos, inclusive à noite. E ou toque mostra a carga.",
  planetaryOxygenGenerator:
    "Fornece oxigênio em toda a superfície enquanto houver energia. Instale 5 placas solares expostas e uma bateria a até 12 blocos.",
  oxygenGenerator:
    "Produz e armazena O₂ usando bateria ou energia solar direta. Recarrega o traje em um cômodo vedado, com paredes de fundo.",
};

export type ConstructionRecipe = Recipe & { id: BuildItem };
export const constructionRecipes = buildItems.map(
  (id) => recipes.find((r) => r.id === id) as ConstructionRecipe,
);
export function canBuild(
  recipe: Recipe,
  inventory: Inventory,
  mission: number,
  capacity: number,
) {
  return craft({ ...inventory }, recipe, capacity, mission);
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export interface BuildFilters {
  search: string;
  category: BuildCategory;
  ready: boolean;
  owned: boolean;
  sort: "name" | "ready" | "owned";
}
export function filterBuildRecipes(
  inventory: Inventory,
  filters: BuildFilters,
  mission = 0,
  capacity = 24,
) {
  const query = normalize(filters.search.trim());
  return constructionRecipes
    .filter(
      (recipe) =>
        (filters.category === "all" ||
          buildCategory(recipe.id) === filters.category) &&
        (!filters.owned || (inventory[recipe.id] ?? 0) > 0) &&
        (!filters.ready || canBuild(recipe, inventory, mission, capacity)) &&
        (!query ||
          normalize(
            `${buildCategories[buildCategory(recipe.id)]} ${items[recipe.id].name} ${buildDescriptions[recipe.id]} ${inventoryEntries(
              recipe.cost,
            )
              .map(([id]) => items[id].name)
              .join(" ")}`,
          ).includes(query)),
    )
    .sort(
      (a, b) =>
        (filters.sort === "ready"
          ? Number(canBuild(b, inventory, mission, capacity)) -
            Number(canBuild(a, inventory, mission, capacity))
          : filters.sort === "owned"
            ? (inventory[b.id] ?? 0) - (inventory[a.id] ?? 0)
            : 0) || items[a.id].name.localeCompare(items[b.id].name, "pt-BR"),
    );
}
