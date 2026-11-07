<script setup lang="ts">
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import { blackMarketPrice, sellContraband } from "../combat/traffic";

const g = useGame();
const quantity = ref(1);
const stock = computed(() => g.state.inventory.sealedCargo ?? 0);
const price = computed(() => blackMarketPrice(g.state));
const valid = computed(
  () =>
    Number.isSafeInteger(quantity.value) &&
    quantity.value > 0 &&
    quantity.value <= stock.value,
);
async function sell() {
  if (
    await g.stationTransaction((draft) => sellContraband(draft, quantity.value))
  )
    g.notify("Venda clandestina concluída. Créditos e XP de Pirata recebidos.");
}
</script>
<template>
  <section class="station-form" aria-label="Mercado clandestino">
    <h3>Mercado clandestino</h3>
    <p>
      O contato compra caixas de contrabando recuperadas de destroços. A patente
      de Pirata aumenta a cotação.
    </p>
    <p>
      Na carga: {{ stock }} caixa(s) · {{ price.toLocaleString("pt-BR") }} CR
      por caixa
    </p>
    <form class="station-form" @submit.prevent="sell">
      <label for="contraband-quantity">Quantidade</label>
      <input
        id="contraband-quantity"
        v-model.number="quantity"
        type="number"
        min="1"
        :max="Math.max(1, stock)"
        step="1"
        inputmode="numeric"
      />
      <button class="primary" :disabled="g.trading || !valid">
        Vender contrabando ·
        {{ valid ? (quantity * price).toLocaleString("pt-BR") : "—" }} CR
      </button>
    </form>
  </section>
</template>
