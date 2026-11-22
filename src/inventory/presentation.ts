import { items, type Inventory, type Item } from "../game/types";
import { inventoryEntries } from "./inventory";
import { isBuildItem } from "../construction/building";
import { foodValue } from "../survival/food";
import { isPhotonSaber, isHeatDeflector } from "../universe/stars";
import { isWeaponModule } from "../combat/weapons";
import { isScannerEquipment } from "../combat/shipScanners";
export type ItemCategory =
  "all" | "materials" | "food" | "building" | "equipment";
export function itemCategory(id: Item): Exclude<ItemCategory, "all"> {
  if (isBuildItem(id)) return "building";
  if (foodValue(id)) return "food";
  if (
    isPhotonSaber(id) ||
    isHeatDeflector(id) ||
    isWeaponModule(id) ||
    isScannerEquipment(id) ||
    [
      "autoFeeder",
      "bucket",
      "autoOxygen",
      "engine",
      "laser",
      "tank",
      "shield",
      "cargo",
      "jump",
      "drill",
      "repair",
      "oxygen",
      "cell",
      "fuel",
      "oxygenCartridge",
      "emptyOxygenCartridge",
    ].includes(id)
  )
    return "equipment";
  return "materials";
}
export function filterInventory(
  inventory: Inventory,
  query: string,
  category: string,
  sort: string,
) {
  const search = query
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return inventoryEntries(inventory)
    .filter(
      ([id, count]) =>
        count > 0 &&
        items[id].name
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(search) &&
        (category === "all" || itemCategory(id) === category),
    )
    .sort(
      ([a, an], [b, bn]) =>
        (sort === "quantity" ? bn - an : 0) ||
        items[a].name.localeCompare(items[b].name, "pt-BR"),
    );
}
