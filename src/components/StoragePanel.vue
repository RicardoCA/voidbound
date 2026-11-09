<script setup lang="ts">
import MeatShelfLife from "./MeatShelfLife.vue";
import ItemIcon from "./ItemIcon.vue";
import TransferAmount from "./TransferAmount.vue";
import { computed, ref } from "vue";
import { BACKPACK_SLOTS, useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { items, type Inventory } from "../game/types";
import { inventoryEntries, slots } from "../inventory/inventory";
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
    title:
      b.containerKind === "fridge"
        ? "Geladeira no planeta"
        : "Armário no planeta",
    data: b.container ?? {},
    capacity: b.containerCapacity,
    action: "Retirar",
  },
]);
const entries = (inventory: Inventory, meatOnly: boolean) =>
  inventoryEntries(inventory).filter(
    ([id, n]) => n > 0 && (!meatOnly || id === "rawMeat"),
  );
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
        <h2>{{ items[b.containerKind ?? "cabinet"].name }}</h2>
      </div>
      <button class="close" aria-label="Fechar armário" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p v-if="b.containerKind === 'fridge'">
      {{
        b.fridgePowered
          ? "Geladeira ligada. A validade da carne está pausada."
          : "Geladeira desligada. A carne continua envelhecendo. Verifique as placas solares e baterias próximas."
      }}
    </p>
    <p v-else>
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
        <p
          v-if="
            !entries(
              list.data,
              b.containerKind === 'fridge' && list.id === 'deposit',
            ).length
          "
          class="storage-empty"
        >
          Nenhum item guardado aqui.
        </p>
        <div
          v-for="[id, n] in entries(
            list.data,
            b.containerKind === 'fridge' && list.id === 'deposit',
          )"
          :key="id"
          class="storage-row"
        >
          <ItemIcon :item="id" />
          <div>
            <b>{{ items[id].name }}</b
            ><small>{{ n }} unidades</small>
            <MeatShelfLife
              v-if="id === 'rawMeat'"
              :inventory="list.data"
              :time="g.state.time"
              :in-fridge="
                list.id === 'withdraw' && b.containerKind === 'fridge'
              "
              :paused="list.id === 'withdraw' && b.fridgePowered"
            />
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
