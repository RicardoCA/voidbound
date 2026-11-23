<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { canCraftScanner, isScannerEquipment } from "../combat/shipScanners";
import { canCraftWeapon, isWeaponModule, weaponModules } from "../combat/weapons";
import { isBuildItem } from "../construction/building";
import { craft, recipes, type Recipe } from "../crafting/recipes";
import { items, type Item } from "../game/types";
import { inventoryEntries, slots } from "../inventory/inventory";
import { normalizeItemSearch } from "../inventory/presentation";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import ItemIcon from "./ItemIcon.vue";

const g = useGame();
const surface = computed(() => g.state.mode === "surface");
const inventory = computed(() => surface.value ? g.state.backpack : g.state.inventory);
const capacity = computed(() => surface.value ? BACKPACK_SLOTS : g.capacity);
const usedSlots = computed(() => slots(inventory.value));
const sourceName = computed(() => surface.value ? "Mochila" : "Carga da nave");
const title = computed(() => g.atWorkbench
  ? "Bancada planetária"
  : g.canAccessShipCargo ? "Bancada da nave" : "Fabricação manual");

const categories = {
  all: "Todas",
  supplies: "Suprimentos",
  buildings: "Construções",
  upgrades: "Melhorias",
  weapons: "Armamentos",
};
type Category = keyof typeof categories;
const visibleCategories = computed(() =>
  (Object.entries(categories) as [Category, string][]).filter(([id]) =>
    id !== "buildings" || g.canAccessShipCargo || g.atWorkbench),
);
const search = ref("");
const category = ref<Category>("all");
const readyOnly = ref(false);
const selected = ref<Item>();
const details = ref<HTMLElement>();
async function selectRecipe(id: Item) {
  selected.value = id;
  if (window.matchMedia("(max-width: 600px)").matches) {
    await nextTick();
    details.value?.scrollIntoView({ block: "nearest" });
  }
}

function recipeCategory(recipe: Recipe): Exclude<Category, "all"> {
  if (isWeaponModule(recipe.id)) return "weapons";
  if (isBuildItem(recipe.id)) return "buildings";
  return recipe.unlock > 0 || isScannerEquipment(recipe.id) ? "upgrades" : "supplies";
}

function unavailable(recipe: Recipe) {
  if (!g.canAccessShipCargo && !g.atWorkbench && !(surface.value && recipe.station === "hand"))
    return "Requer bancada";
  if (!canCraftWeapon(g.state, recipe.id) || !canCraftScanner(g.state, recipe.id))
    return "Projeto restrito";
  if (g.state.mission < recipe.unlock) return "Missão pendente";
  if (inventoryEntries(recipe.cost).some(([id, amount]) => (inventory.value[id] ?? 0) < amount))
    return "Faltam materiais";
  if (!craft({ ...inventory.value }, recipe, capacity.value, g.state.mission))
    return "Sem espaço";
  return "";
}

const matches = computed(() => {
  const query = normalizeItemSearch(search.value);
  return recipes
    .filter(recipe => (recipe.station !== "bench" || g.canAccessShipCargo || g.atWorkbench) &&
      (category.value === "all" || recipeCategory(recipe) === category.value) &&
      normalizeItemSearch(items[recipe.id].name).includes(query))
    .map(recipe => ({ recipe, status: unavailable(recipe) }))
    .sort((a, b) => items[a.recipe.id].name.localeCompare(items[b.recipe.id].name, "pt-BR"));
});
const visible = computed(() => readyOnly.value ? matches.value.filter(entry => !entry.status) : matches.value);
const current = computed(() => matches.value.find(entry => entry.recipe.id === selected.value) ?? visible.value[0]);
function make(id: Item) {
  selected.value = id;
  g.make(id);
}
</script>

<template>
  <section class="dialog inventory-dialog crafting-dialog">
    <div class="dialog-heading">
      <h2>{{ title }}</h2>
      <button class="close" aria-label="Fechar fabricação" @click="g.panel = ''">×</button>
    </div>
    <section class="backpack-browser" aria-label="Receitas de fabricação">
      <div class="backpack-capacity">
        <span>{{ sourceName }}</span>
        <span>{{ usedSlots }} / {{ capacity }} slots</span>
      </div>
      <progress :value="usedSlots" :max="capacity" :aria-label="`Espaço ocupado · ${sourceName}`" />
      <div class="backpack-filters craft-filters">
        <label>
          Buscar receita
          <input v-model="search" type="search" placeholder="Ex. placa metálica" />
        </label>
        <label class="craft-ready">
          <input v-model="readyOnly" type="checkbox" @change="selected = undefined" />
          Só fabricáveis
        </label>
      </div>
      <div class="backpack-categories" role="group" aria-label="Categorias de receitas">
        <button v-for="[id, label] in visibleCategories" :key="id" class="secondary"
          :aria-pressed="category === id" @click="category = id">
          {{ label }}
        </button>
      </div>
      <div class="backpack-content craft-content">
        <div class="backpack-grid">
          <button v-for="{ recipe, status } in visible" :key="recipe.id" type="button"
            class="backpack-item" :class="{ selected: current?.recipe.id === recipe.id }"
            :style="{ '--item-color': items[recipe.id].color }"
            :aria-pressed="current?.recipe.id === recipe.id" @click="selectRecipe(recipe.id)">
            <ItemIcon :item="recipe.id" />
            <b>×{{ recipe.amount ?? 1 }}</b>
            <span>{{ items[recipe.id].name }}</span>
            <small :class="{ ready: !status }">{{ status || "Disponível" }}</small>
          </button>
          <p v-if="!visible.length" class="backpack-empty">Nenhuma receita corresponde aos filtros.</p>
        </div>
        <aside v-if="current" ref="details" class="backpack-detail" aria-label="Detalhes da receita">
          <ItemIcon :item="current.recipe.id" />
          <h3>{{ items[current.recipe.id].name }}</h3>
          <span>{{ categories[recipeCategory(current.recipe)] }} · {{ items[current.recipe.id].rarity }}</span>
          <p v-if="isWeaponModule(current.recipe.id)">{{ weaponModules[current.recipe.id].description }}</p>
          <dl>
            <div>
              <dt>Rendimento</dt><dd>{{ current.recipe.amount ?? 1 }}</dd>
            </div>
            <div>
              <dt>Em estoque</dt><dd>{{ inventory[current.recipe.id] ?? 0 }}</dd>
            </div>
          </dl>
          <div class="craft-ingredients">
            <h4>Materiais</h4>
            <ul>
              <li v-for="[id, amount] in inventoryEntries(current.recipe.cost)" :key="id"
                :class="{ missing: (inventory[id] ?? 0) < amount }">
                <ItemIcon :item="id" />
                <span>{{ items[id].name }}</span>
                <b :aria-label="`${inventory[id] ?? 0} disponíveis de ${amount} necessários`">{{ inventory[id] ?? 0 }}/{{ amount }}</b>
              </li>
            </ul>
          </div>
          <p v-if="current.status" class="craft-status">{{ current.status }}</p>
          <button class="primary backpack-use" :disabled="!!current.status || g.trading"
            @click="make(current.recipe.id)">
            Fabricar ×{{ current.recipe.amount ?? 1 }}
          </button>
        </aside>
      </div>
    </section>
  </section>
</template>

<style scoped src="./item-browser.css"></style>
<style scoped>
.crafting-dialog {
  width: min(1080px, 100%);
}
.craft-filters {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}
.craft-filters .craft-ready {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
}
.craft-ready input {
  width: 18px;
  height: 18px;
  min-height: 0;
  accent-color: var(--mint);
}
.craft-content {
  margin-top: 12px;
}
.backpack-item small {
  color: #a8bdc7;
  font-size: 11px;
}
.backpack-item .ready {
  color: var(--mint);
}
.craft-ingredients h4 {
  margin: 0;
  font-size: 12px;
}
.craft-ingredients ul {
  padding: 0;
  margin: 4px 0 0;
  list-style: none;
  font-size: 12px;
}
.craft-ingredients li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 5px 0;
  border-bottom: 1px solid #253b49;
}
.craft-ingredients .item-art {
  width: 24px;
  height: 24px;
}
.craft-ingredients .missing b,
.backpack-detail .craft-status {
  color: #f3b29f;
}
@media (max-width: 370px) {
  .craft-filters {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
