<script setup lang="ts">
import { inventoryEntries } from "../inventory/inventory";
import ItemIcon from "./ItemIcon.vue";
import { computed } from "vue";
import { useBases } from "../stores/bases";
import { useGame } from "../stores/game";
import { items } from "../game/types";
const props = defineProps<{ planetId: string }>();
const bases = useBases(),
  g = useGame();
const base = computed(() =>
  bases.all.find((entry) => entry.planet.id === props.planetId),
);
const entries = computed(() => inventoryEntries(base.value?.inventory ?? {}));
</script>
<template>
  <section v-if="base" class="orbit-base-summary">
    <h3>⌂ Sua base neste planeta</h3>
    <p>
      {{ base.cabinets.length }} armários · {{ base.units }} unidades guardadas
      · {{ base.pieces + base.walls }} peças construídas
    </p>
    <div class="base-items">
      <span v-for="[id, n] in entries" :key="id"
        ><ItemIcon :item="id" />{{ items[id].name }} <b>×{{ n }}</b></span
      >
    </div>
    <button class="text-button" @click="g.panel = 'bases'">
      Ver bases, conteúdo e coordenadas →
    </button>
  </section>
</template>
