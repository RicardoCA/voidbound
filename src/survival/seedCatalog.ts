export const treeNames = [
  "Cedro de basalto", "Acácia âmbar", "Conífera glacial",
  "Copa de jade", "Árvore brasa", "Mangue-lâmina",
] as const;

export const fruitNames = {
  basaltBerry: "Baga de basalto", amberFig: "Figo âmbar", frostPlum: "Ameixa glacial",
  jadePear: "Pera de jade", emberFruit: "Fruta brasa", tideMelon: "Melão de maré",
};
export type FruitItem = keyof typeof fruitNames;
const fruitKinds = Object.keys(fruitNames);
export const fruitKind = (fruit: FruitItem) => fruitKinds.indexOf(fruit);
type TreeSeed = `treeSeed-${0 | 1 | 2 | 3 | 4 | 5}`;
type FruitSeed = `fruitSeed-${FruitItem}`;
export type SeedItem = TreeSeed | FruitSeed;

export const seedNames = Object.fromEntries([
  ...treeNames.map((name, index) => [`treeSeed-${index}`, `Semente de ${name.toLocaleLowerCase("pt-BR")}`]),
  ...Object.entries(fruitNames).map(([fruit, name]) => [`fruitSeed-${fruit}`, `Muda de ${name.toLocaleLowerCase("pt-BR")}`]),
]) as Record<SeedItem, string>;

export function isSeed(item: string): item is SeedItem {
  return Object.hasOwn(seedNames, item);
}

export const treeSeedFor = (kind: number) => `treeSeed-${kind}` as TreeSeed;
export const fruitSeedFor = (fruit: FruitItem): FruitSeed => `fruitSeed-${fruit}`;
export function seedBiome(seed: SeedItem) {
  return seed.startsWith("treeSeed-")
    ? Number(seed.slice("treeSeed-".length))
    : fruitKind(seed.slice("fruitSeed-".length) as FruitItem);
}

export const CROP_GROWTH = 60;
export function cropReady(plant: { growth: number }) {
  return plant.growth >= CROP_GROWTH;
}
