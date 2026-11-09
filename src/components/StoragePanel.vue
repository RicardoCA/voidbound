<script setup lang="ts">
import ItemIcon from "./ItemIcon.vue";
import TransferAmount from "./TransferAmount.vue";
import { computed, ref } from "vue";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { items, type Item, type Inventory } from "../game/types";
import { slots } from "../inventory/inventory";
import { CABINET_SLOTS } from "../construction/building";
const g = useGame(),
  b = useConstruction(),
  amount = ref<"1" | "10" | "all">("1");
const lists = computed(() => [
  {
    id: "deposit" as const,
    title: "Sua mochila",
    data: g.state.backpack,
    capacity: BACKPACK_SLOTS,
    action: "Guardar",
  },
  {
    id: "withdraw" as const,
    title: "Armário no planeta",
    data: b.container ?? {},
    capacity: CABINET_SLOTS,
    action: "Retirar",
  },
]);
const entries = (inventory: Inventory) =>
  Object.entries(inventory).filter(([, n]) => n! > 0) as [Item, number][];
function quantity(available: number) {
  return amount.value === "all"
    ? available
    : Math.min(Number(amount.value), available);
}
</script>
<template>
  <section class="dialog storage-panel">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">ARMAZENAMENTO LOCAL / {{ g.planet.name }}</div>
        <h2>Armário planetário</h2>
      </div>
      <button class="close" aria-label="Fechar armário" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p>
      Os itens ficam neste armário, neste planeta, mesmo quando você decola ou
      fecha o jogo.
    </p>
    <button class="text-button" @click="g.panel = 'bases'">
      Ver meus depósitos em todos os planetas →
    </button>
    <TransferAmount v-model="amount" />
    <div v-if="b.container" class="storage-columns">
      <section v-for="list in lists" :key="list.id" class="storage-column">
        <div class="storage-heading">
          <h3>{{ list.title }}</h3>
          <span>{{ slots(list.data) }} / {{ list.capacity }} slots</span>
        </div>
        <p v-if="!entries(list.data).length" class="storage-empty">
          Nenhum item guardado aqui.
        </p>
        <div
          v-for="[id, n] in entries(list.data)"
          :key="id"
          class="storage-row"
        >
          <ItemIcon :item="id" />
          <div>
            <b>{{ items[id].name }}</b
            ><small>{{ n }} unidades</small>
          </div>
          <button
            class="secondary"
            :aria-label="`${list.action} ${items[id].name}`"
            @click="b.moveItem(list.id, id, quantity(n))"
          >
            {{ list.action }} {{ quantity(n) }}
            {{ list.id === "deposit" ? "→" : "←" }}
          </button>
        </div>
      </section>
    </div>
    <p v-else class="warning">
      Armário indisponível. Volte à superfície e abra um armário próximo.
    </p>
  </section>
</template>
