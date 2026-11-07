<script setup lang="ts">
import { computed } from "vue";
import { items, type Item } from "../game/types";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { isBuildItem } from "../construction/building";
const g = useGame(),
  b = useConstruction();
function use(id: Item) {
  if (isBuildItem(id)) {
    if (g.state.mode === "surface") b.equip(id);
    else g.notify("Saia da nave para equipar uma peça de construção.");
  } else g.use(id);
}
function open(id: string) {
  g.panel = g.panel === id ? "" : id;
}
const inventory = computed(
  () =>
    Object.entries(g.state.inventory).filter(([, n]) => n! > 0) as [
      Item,
      number,
    ][],
);
function canUse(id: Item) {
  return [
    "repair",
    "fuel",
    "oxygen",
    "cell",
    "engine",
    "laser",
    "tank",
    "shield",
    "cargo",
    "jump",
    "drill",
  ].includes(id);
}
</script>
<template>
  <section class="dialog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">{{ g.model.name }} / COMPARTIMENTO DE CARGA</div>
        <h2>Carga & equipamentos</h2>
      </div>
      <button
        class="close"
        aria-label="Fechar inventário"
        @click="open('inventory')"
      >
        ×
      </button>
    </div>
    <div class="inventory-heading">
      <span>{{ g.usedSlots }} / {{ g.capacity }} SLOTS</span
      ><span>EMPILHAMENTO: 99 / RECURSO</span>
    </div>
    <div class="inventory-grid">
      <button
        v-for="[id, n] in inventory"
        :key="id"
        class="item-cell"
        :style="{ '--item-color': items[id].color }"
        @click="use(id)"
      >
        <span class="item-icon">{{ items[id].icon }}</span
        ><b>{{ n }}</b
        ><span>{{ items[id].name }}</span
        ><small>{{
          isBuildItem(id)
            ? "EQUIPAR CONSTRUÇÃO"
            : canUse(id)
              ? "USAR / INSTALAR"
              : items[id].rarity
        }}</small>
      </button>
      <div
        v-for="n in Math.max(0, 12 - inventory.length)"
        :key="`empty-${n}`"
        class="empty-cell"
      >
        +
      </div>
    </div>
    <p v-if="!inventory.length" class="empty-message">
      Seu próximo recurso está lá fora. Minere blocos na superfície ou
      asteroides no espaço.
    </p>
    <div class="installed">
      MELHORIAS INSTALADAS <span v-if="!g.state.upgrades.length">Nenhuma</span
      ><b v-for="id in g.state.upgrades" :key="id">{{ items[id].name }}</b>
    </div>
  </section>
</template>
