<script setup lang="ts">
import ItemIcon from "./ItemIcon.vue";
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import { useBases } from "../stores/bases";
import { items, biomes, type Item } from "../game/types";
import { CABINET_SLOTS } from "../construction/building";
import type { BaseSummary } from "../construction/catalog";
const props = defineProps<{ focusPlanet?: string }>();
const emit = defineEmits<{ locate: [base: BaseSummary]; clearFocus: [] }>();
const g = useGame(),
  bases = useBases(),
  search = ref(""),
  onlyStored = ref(false);
const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const visible = computed(() => {
  const query = normalized(search.value.trim());
  return bases.all.filter(
    (base) =>
      (!props.focusPlanet || base.planet.id === props.focusPlanet) &&
      (!onlyStored.value || base.units > 0) &&
      (!query ||
        normalized(
          `${base.planet.name} ${base.system.name} ${base.system.x},${base.system.y} ${Object.keys(
            base.inventory,
          )
            .map((id) => items[id as Item].name)
            .join(" ")}`,
        ).includes(query)),
  );
});
const units = (n: number) => `${n} ${n === 1 ? "unidade" : "unidades"}`;
const entries = (inventory: BaseSummary["inventory"]) =>
  Object.entries(inventory) as [Item, number][];
</script>
<template>
  <div class="base-registry">
    <div class="registry-summary">
      <span
        ><b>{{ bases.storedPlanets }}</b>
        {{
          bases.storedPlanets === 1 ? "planeta com itens" : "planetas com itens"
        }}</span
      ><span
        ><b>{{ bases.totalUnits }}</b>
        {{
          bases.totalUnits === 1 ? "unidade guardada" : "unidades guardadas"
        }}</span
      >
    </div>
    <p class="registry-help">
      Consulta dos seus armários. Para guardar ou retirar itens, viaje ao
      planeta e abra o armário na superfície.
    </p>
    <div class="registry-filters">
      <label class="registry-search"
        ><span>BUSCAR</span
        ><input
          v-model="search"
          @keydown.stop
          @keyup.stop
          type="search"
          placeholder="Planeta, sistema ou recurso"
          aria-label="Buscar bases e recursos" /></label
      ><label class="registry-check"
        ><input v-model="onlyStored" type="checkbox" /> Só com itens</label
      >
    </div>
    <button v-if="focusPlanet" class="text-button" @click="emit('clearFocus')">
      ← Mostrar todos os planetas
    </button>
    <div v-if="!visible.length" class="registry-empty">
      {{
        bases.all.length
          ? "Nenhuma base corresponde aos filtros."
          : "Seus planetas aparecerão aqui quando você construir. Guarde itens em um armário para ver o conteúdo neste catálogo."
      }}
    </div>
    <article v-for="base in visible" :key="base.planet.id" class="base-card">
      <div class="base-heading">
        <div>
          <span class="eyebrow"
            >{{ biomes[base.planet.kind]?.name }} · SETOR {{ base.system.x }},
            {{ base.system.y }}</span
          >
          <h3>{{ base.planet.name }}</h3>
          <small
            >{{ base.system.name }}
            <b v-if="base.system.id === g.system.id">· Neste sistema</b></small
          >
        </div>
        <button
          class="secondary"
          :aria-label="`Localizar ${base.planet.name} no mapa`"
          @click="emit('locate', base)"
        >
          LOCALIZAR ↗
        </button>
      </div>
      <div class="base-counts">
        <span
          >⌂ {{ base.pieces + base.walls }}
          {{
            base.pieces + base.walls === 1
              ? "peça construída"
              : "peças construídas"
          }}</span
        ><span
          >▤ {{ base.cabinets.length }}
          {{ base.cabinets.length === 1 ? "armário" : "armários" }} ·
          {{ base.occupiedCabinets }} com itens</span
        ><strong>{{ units(base.units) }}</strong>
      </div>
      <div v-if="base.units" class="base-items">
        <span v-for="[id, n] in entries(base.inventory)" :key="id">
          <ItemIcon :item="id" />
          {{ items[id].name }} <b>×{{ n }}</b>
        </span>
      </div>
      <p v-else class="base-empty-stock">
        {{
          base.cabinets.length
            ? "Todos os armários estão vazios."
            : "Base sem armários."
        }}
      </p>
      <details v-if="base.cabinets.length" class="cabinet-locations">
        <summary>Ver armários, coordenadas e conteúdo</summary>
        <section
          v-for="cabinet in base.cabinets"
          :key="cabinet.key"
          class="cabinet-location"
        >
          <h4>Armário · bloco ({{ cabinet.x }}, {{ cabinet.y }})</h4>
          <p>
            {{ units(cabinet.units) }} · {{ cabinet.usedSlots }} /
            {{ CABINET_SLOTS }} slots
          </p>
          <p>
            Pouso mais próximo: <b>{{ cabinet.landing.name }}</b> ·
            {{ Math.abs(cabinet.x - cabinet.landing.tileX) }} blocos
            {{ cabinet.x < cabinet.landing.tileX ? "a oeste" : "a leste" }} do
            pouso.
          </p>
          <div v-if="cabinet.units" class="base-items">
            <span v-for="[id, n] in entries(cabinet.inventory)" :key="id"
              >{{ items[id].name }} <b>×{{ n }}</b></span
            >
          </div>
          <p v-else>Armário vazio.</p>
        </section>
      </details>
    </article>
  </div>
</template>
