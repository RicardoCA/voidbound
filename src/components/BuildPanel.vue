<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { inventoryEntries } from "../inventory/inventory";
import ItemIcon from "./ItemIcon.vue";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import HabitatStatus from "./HabitatStatus.vue";
import { items, type BuildItem } from "../game/types";
import {
  buildCategories,
  buildCategory,
  buildDescriptions,
  constructionRecipes,
  canBuild,
  filterBuildRecipes,
  type BuildFilters,
} from "../construction/menu";
import { pieceWidth, isDoor } from "../construction/pieces";
import { isFacility } from "../construction/facilityTypes";
const g = useGame(),
  b = useConstruction();
const filters = reactive<BuildFilters>({
  search: "",
  category: "all",
  ready: false,
  owned: false,
  sort: "name",
});
const selected = ref<BuildItem>("woodBlock");
const visible = computed(() =>
  filterBuildRecipes(
    g.state.backpack,
    filters,
    g.state.mission,
    BACKPACK_SLOTS,
  ),
);
const active = computed(
  () => visible.value.find((r) => r.id === selected.value) ?? visible.value[0],
);
const readyCount = computed(
  () =>
    constructionRecipes.filter((r) =>
      canBuild(r, g.state.backpack, g.state.mission, BACKPACK_SLOTS),
    ).length,
);
const ownedCount = computed(() =>
  constructionRecipes.reduce((n, r) => n + (g.state.backpack[r.id] ?? 0), 0),
);
const status = ref("");
function resetFilters() {
  filters.search = "";
  filters.category = "all";
  filters.ready = false;
  filters.owned = false;
}
function make() {
  const recipe = active.value;
  if (!recipe) return;
  const before = g.state.backpack[recipe.id] ?? 0;
  g.make(recipe.id);
  status.value =
    (g.state.backpack[recipe.id] ?? 0) > before
      ? `${items[recipe.id].name}: ${recipe.amount ?? 1} fabricado(s). Já pode equipar.`
      : g.notice;
}
</script>
<template>
  <section class="dialog build-panel build-catalog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">OFICINA DE CAMPO / {{ g.planet.name }}</div>
        <h2>Construção de bases</h2>
      </div>
      <button
        class="close"
        aria-label="Fechar construção"
        @click="g.panel = ''"
      >
        ×
      </button>
    </div>
    <div class="build-overview">
      <span>{{ constructionRecipes.length }} projetos</span
      ><span>{{ readyCount }} fabricáveis</span
      ><span>{{ ownedCount }} peças na mochila</span>
      <button type="button" class="secondary" @click="g.panel = 'craft'">
        Receitas de fabricação
      </button>
    </div>
    <div class="build-materials">
      <span v-for="id in ['wood', 'stone', 'iron'] as const" :key="id"
        ><ItemIcon :item="id" />{{ items[id].name }}
        <b>{{ g.state.backpack[id] ?? 0 }}</b></span
      >
    </div>
    <div class="build-filters">
      <label
        >Buscar construção<input
          v-model="filters.search"
          type="search"
          placeholder="Nome, função ou material"
      /></label>
      <label
        >Ordenar<select v-model="filters.sort">
          <option value="name">Nome</option>
          <option value="ready">Fabricáveis primeiro</option>
          <option value="owned">Quantidade na mochila</option>
        </select></label
      >
    </div>
    <div class="build-categories" role="group" aria-label="Tipo de construção">
      <button
        v-for="(label, id) in buildCategories"
        :key="id"
        class="secondary"
        :aria-pressed="filters.category === id"
        @click="filters.category = id"
      >
        {{ label }}
      </button>
    </div>
    <div class="build-toggles">
      <label
        ><input v-model="filters.ready" type="checkbox" /> Só fabricáveis</label
      ><label
        ><input v-model="filters.owned" type="checkbox" /> Só na mochila</label
      ><span>{{ visible.length }} resultados</span>
    </div>
    <div class="build-catalog-content">
      <div class="build-picker" aria-label="Projetos de construção">
        <button
          v-for="recipe in visible"
          :key="recipe.id"
          class="build-pick"
          :class="{ selected: active?.id === recipe.id }"
          :aria-pressed="active?.id === recipe.id"
          :aria-label="`Selecionar ${items[recipe.id].name}`"
          @click="selected = recipe.id"
        >
          <ItemIcon :item="recipe.id" /><b>{{
            g.state.backpack[recipe.id] ?? 0
          }}</b
          ><strong>{{ items[recipe.id].name }}</strong
          ><small>{{ buildCategories[buildCategory(recipe.id)] }}</small>
          <span
            class="build-availability"
            :class="{
              ready: canBuild(
                recipe,
                g.state.backpack,
                g.state.mission,
                BACKPACK_SLOTS,
              ),
            }"
            >{{
              canBuild(
                recipe,
                g.state.backpack,
                g.state.mission,
                BACKPACK_SLOTS,
              )
                ? "Fabricável"
                : "Ver requisitos"
            }}</span
          >
        </button>
        <div v-if="!visible.length" class="build-empty">
          <p>Nenhuma construção corresponde aos filtros.</p>
          <button class="secondary" @click="resetFilters">
            Limpar filtros
          </button>
        </div>
      </div>
      <aside class="build-detail" aria-label="Detalhes da construção">
        <template v-if="active">
          <ItemIcon :item="active.id" />
          <h3>{{ items[active.id].name }}</h3>
          <small
            >{{ buildCategories[buildCategory(active.id)] }} ·
            {{ pieceWidth(active.id) }} ×
            {{
              isDoor(active.id) || isFacility(active.id) ? 2 : 1
            }}
            células</small
          >
          <p>{{ buildDescriptions[active.id] }}</p>
          <strong
            >{{ g.state.backpack[active.id] ?? 0 }} na mochila · Produz
            {{ active.amount ?? 1 }} por fabricação</strong
          >
          <h4>Materiais da mochila</h4>
          <div class="build-requirements">
            <div
              v-for="[id, n] in inventoryEntries(active.cost)"
              :key="id"
              :class="{ missing: (g.state.backpack[id] ?? 0) < n }"
            >
              <ItemIcon :item="id" /><span
                >{{ items[id].name
                }}<small v-if="(g.state.backpack[id] ?? 0) < n"
                  >Faltam {{ n - (g.state.backpack[id] ?? 0) }}</small
                ></span
              ><b>{{ g.state.backpack[id] ?? 0 }} / {{ n }}</b>
            </div>
          </div>
          <p
            v-if="
              !canBuild(
                active,
                g.state.backpack,
                g.state.mission,
                BACKPACK_SLOTS,
              )
            "
            class="build-missing"
          >
            Confira os materiais e o espaço na mochila para receber as peças.
          </p>
          <div class="build-detail-actions">
            <button
              class="secondary"
              :disabled="
                !canBuild(
                  active,
                  g.state.backpack,
                  g.state.mission,
                  BACKPACK_SLOTS,
                )
              "
              @click="make"
            >
              Fabricar {{ active.amount ?? 1 }}</button
            ><button
              class="primary"
              :disabled="!(g.state.backpack[active.id] ?? 0)"
              @click="b.equip(active.id)"
            >
              Equipar
            </button>
          </div>
          <p class="build-safe-help">
            Selecionar apenas mostra os detalhes. Fabrique para produzir peças;
            equipe para colocá-las no mundo.
          </p>
        </template>
        <p v-else>Limpe os filtros para consultar os projetos de construção.</p>
      </aside>
    </div>
    <p class="build-feedback" role="status" aria-live="polite">{{ status }}</p>
    <details class="build-guide">
      <summary>Ajuda de construção e suporte de vida</summary>
      <HabitatStatus always />
      <p>
        Coloque peças ao alcance de 6 blocos, conectadas ao terreno ou à casa.
        Toque ou clique no mundo para construir. A prévia indica se a posição é
        válida. Esvazie armários e instalações antes de desmontá-los.
      </p>
      <p>
        Para recarregar o traje, feche piso, teto e laterais com paredes,
        janelas e portas. Instale o gerador no cômodo vedado; placas precisam de
        céu livre e a bateria mantém energia à noite. Os equipamentos se
        conectam a até 12 blocos. Para antecâmara, use duas portas alinhadas no
        mesmo piso e separadas por 1 a 5 blocos.
      </p>
      <p>
        Esta oficina usa exclusivamente os materiais da mochila. Construções e
        reservatórios são salvos por planeta.
      </p>
    </details>
  </section>
</template>
<style scoped>
.build-catalog {
  width: min(1100px, 100%);
}
.build-overview {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  font-size: 12px;
  color: #b0cbd0;
  margin-bottom: 12px;
}
.build-filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
  margin: 16px 0 12px;
}
.build-filters label {
  display: grid;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
  color: #a2bbc5;
}
.build-filters input,
.build-filters select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px;
  background: #0e1b28;
  color: #d7e7eb;
  border: 1px solid #3c5360;
}
.build-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.build-categories button {
  min-height: 44px;
  padding: 8px 12px;
  font-size: 11px;
}
.build-categories button[aria-pressed="true"] {
  background: #284a4c;
  border-color: #9cdacf;
  color: #baf9e8;
}
.build-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
  padding: 12px 0;
  font-size: 12px;
}
.build-toggles label {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  cursor: pointer;
}
.build-toggles input {
  width: 18px;
  height: 18px;
  accent-color: #96d7ca;
}
.build-toggles > span {
  margin-left: auto;
  color: #9bb9c5;
}
.build-catalog-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 16px;
  align-items: start;
}
.build-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
  align-content: start;
  gap: 8px;
  max-height: 53vh;
  overflow: auto;
  padding: 2px;
  scrollbar-width: thin;
}
.build-pick {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 150px;
  padding: 12px;
  text-align: left;
  background: #112333;
  border: 1px solid #344954;
  color: #d7e7eb;
}
.build-pick.selected {
  outline: 2px solid #98e3d7;
  outline-offset: -2px;
  background: #234147;
}
.build-pick > .item-art {
  width: 38px;
  height: 38px;
}
.build-pick > b {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #acdacf;
  font-size: 14px;
}
.build-pick strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.build-pick small {
  font-size: 10px;
  color: #9bb5c0;
}
.build-availability {
  font-size: 10px;
  color: #d8b286;
  margin-top: auto;
}
.build-availability.ready {
  color: #a3e5bc;
}
.build-detail {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid #345260;
  background: #0c1925;
  min-width: 0;
}
.build-detail > .item-art {
  width: 64px;
  height: 64px;
}
.build-detail h3 {
  margin: 0;
  font-size: 20px;
}
.build-detail h4 {
  margin: 0;
  font-size: 13px;
}
.build-detail > small,
.build-detail > strong {
  font-size: 12px;
  color: #a9d2ca;
}
.build-detail p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}
.build-requirements {
  display: grid;
  gap: 8px;
}
.build-requirements > div {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #253c48;
}
.build-requirements .item-art {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}
.build-requirements span {
  display: grid;
  flex: 1;
  gap: 4px;
}
.build-requirements small {
  font-size: 10px;
}
.build-requirements b {
  font-size: 12px;
  white-space: nowrap;
}
.build-requirements .missing,
.build-missing {
  color: #e8b18a;
}
.build-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.build-detail-actions button {
  flex: 1;
  min-height: 46px;
  padding: 10px;
}
.build-detail .build-safe-help {
  font-size: 11px;
  color: #91aebc;
}
.build-empty {
  grid-column: 1/-1;
}
.build-empty button {
  min-height: 44px;
  padding: 10px;
}
.build-feedback {
  color: #a3ddca;
  font-size: 12px !important;
}
.build-guide {
  margin-top: 14px;
  border-top: 1px solid #345260;
  padding-top: 12px;
}
.build-guide summary {
  min-height: 44px;
  font-size: 13px;
  cursor: pointer;
  color: #a4c9c8;
}
.build-guide p {
  font-size: 12px;
}
@media (max-width: 600px) {
  .build-filters {
    grid-template-columns: 1fr;
  }
  .build-catalog-content {
    grid-template-columns: 1fr;
  }
  .build-picker {
    max-height: 32vh;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
  .build-detail {
    padding: 14px;
  }
  .build-categories button {
    font-size: 10px;
    padding: 8px 10px;
  }
}
</style>
