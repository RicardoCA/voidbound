<script setup lang="ts">
import { computed } from "vue";
import { useGame } from "../stores/game";
import {
  sellScience,
  scienceValue,
  scienceBonus,
} from "../progression/exploration";
import { planetClock } from "../construction/habitat";

defineProps<{ sell?: boolean }>();
const g = useGame();
const discoveries = computed(() =>
  Object.values(g.state.progression.discoveries).reverse(),
);
async function deliver(id: string) {
  if (await g.stationTransaction((draft) => sellScience(draft, id)))
    g.notify("Dados científicos vendidos.");
}
</script>

<template>
  <section class="station-form" aria-label="Registro científico">
    <h3>Registro científico</h3>
    <p v-if="sell">
      Bônus profissional de
      {{
        (scienceBonus(g.state) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })
      }}% sobre os dados vendidos.
    </p>
    <p v-if="!discoveries.length">
      Nenhuma descoberta registrada. Catalogue planetas no Scanner ou ao pousar.
    </p>
    <article v-for="entry in discoveries" :key="entry.id" class="dealer-card">
      <h3>{{ entry.name }}</h3>
      <p>
        Setor {{ entry.sector.x }}, {{ entry.sector.y }} · Hora local
        {{ planetClock(entry.time) }}
      </p>
      <p>{{ entry.notes }}</p>
      <small v-if="entry.soldAt !== undefined">Dados vendidos</small>
      <button
        v-else-if="sell && entry.credits"
        class="primary"
        :disabled="g.trading"
        @click="deliver(entry.id)"
      >
        Vender dados ·
        {{ scienceValue(g.state, entry).toLocaleString("pt-BR") }} CR
      </button>
    </article>
  </section>
</template>
