<script setup lang="ts">
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import { items } from "../game/types";
import {
  marketDeliverySeconds,
  TARGET_STOCK,
  marketItems,
  marketPrice,
  marketStock,
  trade,
  type MarketItem,
  type TradeSide,
} from "../economy/market";
const g = useGame();
const item = ref<MarketItem>("iron");
const quantity = ref(1);
const stock = computed(() =>
  marketStock(g.state, g.system.station!.id, item.value),
);
const deliveryETA = computed(() => {
  const seconds = marketDeliverySeconds(g.state);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
});
const valid = computed(
  () => Number.isSafeInteger(quantity.value) && quantity.value > 0,
);
async function transact(side: TradeSide) {
  const resource = item.value,
    amount = quantity.value;
  const success = await g.stationTransaction((draft, station) =>
    trade(draft, station, resource, side, amount, g.capacity),
  );
  if (success)
    g.notify(
      `${side === "buy" ? "Compra" : "Venda"} concluída. ${amount} × ${items[resource].name}.`,
    );
}
</script>

<template>
  <div class="station-form">
    <label for="market-resource">Recurso</label>
    <select id="market-resource" v-model="item">
      <option v-for="resource in marketItems" :key="resource" :value="resource">
        {{ items[resource].name }}
      </option>
    </select>
    <p>
      Estoque da estação: {{ stock }} · Na sua carga:
      {{ g.state.inventory[item] ?? 0 }} · Slots {{ g.usedSlots }}/{{
        g.capacity
      }}
    </p>
    <p v-if="stock < TARGET_STOCK">
      Próxima entrega de fornecedor em {{ deliveryETA }} de jogo ativo.
    </p>
    <label for="market-quantity">Quantidade</label>
    <input
      id="market-quantity"
      v-model.number="quantity"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
    />
    <div class="station-actions">
      <button
        class="primary"
        :disabled="g.trading || !valid"
        @click="transact('buy')"
      >
        Comprar · {{ valid ? marketPrice(item, "buy") * quantity : "—" }} CR
      </button>
      <button
        class="secondary"
        :disabled="g.trading || !valid"
        @click="transact('sell')"
      >
        Vender · {{ valid ? marketPrice(item, "sell") * quantity : "—" }} CR
      </button>
    </div>
  </div>
</template>
