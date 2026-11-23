<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { buildItems } from "../construction/building";
import ItemIcon from "./ItemIcon.vue";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import HabitatStatus from "./HabitatStatus.vue";
import { items, type BuildItem } from "../game/types";
import {
  buildCategories,
  buildCategory,
  buildDescriptions,
  filterBuildItems,
  type BuildFilters,
} from "../construction/menu";
import { pieceWidth, isDoor } from "../construction/pieces";
import { isFacility } from "../construction/facilityTypes";
const g = useGame(),
  b = useConstruction();
const filters = reactive<BuildFilters>({
  search: "",
  category: "all",
  owned: false,
  sort: "name",
});
const selected = ref<BuildItem>("woodBlock");
const visible = computed(() => filterBuildItems(g.state.backpack, filters));
const active = computed(() => visible.value.includes(selected.value) ? selected.value : visible.value[0]);
const ownedCount = computed(() => buildItems.reduce((total, id) => total + (g.state.backpack[id] ?? 0), 0));
function resetFilters() {
  filters.search = "";
  filters.category = "all";
  filters.owned = false;
}
</script>
<template>
  <section class="dialog build-panel build-catalog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">INSTALAÇÃO / {{ g.planet.name }}</div>
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
      <span>{{ ownedCount }} peças na mochila</span>
    </div>
    <div class="build-filters">
      <label
        >Buscar construção<input
          v-model="filters.search"
          type="search"
          placeholder="Nome ou função"
      /></label>
      <label
        >Ordenar<select v-model="filters.sort">
          <option value="name">Nome</option>
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
        ><input v-model="filters.owned" type="checkbox" /> Só na mochila</label
      ><span>{{ visible.length }} resultados</span>
    </div>
    <div class="build-catalog-content">
      <div class="build-picker" aria-label="Projetos de construção">
        <button v-for="id in visible" :key="id" class="build-pick"
          :class="{ selected: active === id }" :aria-pressed="active === id"
          :aria-label="`Selecionar ${items[id].name}`" @click="selected = id">
          <ItemIcon :item="id" />
          <b>{{ g.state.backpack[id] ?? 0 }}</b>
          <strong>{{ items[id].name }}</strong>
          <small>{{ buildCategories[buildCategory(id)] }}</small>
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
          <ItemIcon :item="active" />
          <h3>{{ items[active].name }}</h3>
          <small
            >{{ buildCategories[buildCategory(active)] }} ·
            {{ pieceWidth(active) }} ×
            {{
              isDoor(active) || isFacility(active) ? 2 : 1
            }}
            células</small
          >
          <p>{{ buildDescriptions[active] }}</p>
          <strong>{{ g.state.backpack[active] ?? 0 }} na mochila</strong>
          <button class="primary build-equip" :disabled="!(g.state.backpack[active] ?? 0)" @click="b.equip(active)">
            Equipar
          </button>
          <p v-if="!g.state.backpack[active]">
            Fabrique esta peça na bancada planetária ou na bancada da nave.
          </p>
        </template>
        <p v-else>Limpe os filtros para consultar os projetos de construção.</p>
      </aside>
    </div>
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
        Construções e reservatórios são salvos por planeta.
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
.build-equip {
  min-height: 46px;
  padding: 10px;
}
.build-empty {
  grid-column: 1/-1;
}
.build-empty button {
  min-height: 44px;
  padding: 10px;
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
