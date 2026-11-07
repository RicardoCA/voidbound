<script setup lang="ts">
import { computed } from "vue";
import { useGame } from "../stores/game";
import { habitatMessage, daylight } from "../construction/habitat";
defineProps<{ always?: boolean }>();
const g = useGame(),
  message = computed(() =>
    !g.habitat.hasGenerator && !g.habitat.sealed
      ? "Instale um gerador dentro da casa e placas solares do lado de fora."
      : habitatMessage(g.habitat),
  );
</script>
<template>
  <section
    v-if="always || g.habitat.hasGenerator || g.habitat.sealed"
    class="habitat-status"
    :class="{ supplied: g.habitat.supplied }"
  >
    <strong>{{ message }}</strong
    ><small v-if="g.habitat.generators || g.habitat.panels"
      >{{ g.habitat.connectedPanels }} placas conectadas · Luz
      {{ Math.round(daylight(g.state.time) * 100) }}% · Energia
      {{ Math.floor(g.habitat.energy) }} · Reserva O₂
      {{ Math.floor(g.habitat.oxygen) }}</small
    >
  </section>
</template>
