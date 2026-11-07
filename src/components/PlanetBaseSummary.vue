<script setup lang="ts">
import { computed } from "vue";
import { useBases } from "../stores/bases";
import { useGame } from "../stores/game";
import { items, type Item } from "../game/types";
const props = defineProps<{ planetId: string }>();
const bases = useBases(),
  g = useGame();
const base = computed(() =>
  bases.all.find((entry) => entry.planet.id === props.planetId),
);
const entries = computed(
  () => Object.entries(base.value?.inventory ?? {}) as [Item, number][],
);
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
        >{{ items[id].name }} <b>×{{ n }}</b></span
      >
    </div>
    <button class="text-button" @click="g.panel = 'bases'">
      Ver bases, conteúdo e coordenadas →
    </button>
  </section>
</template>
