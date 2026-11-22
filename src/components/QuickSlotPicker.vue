<script setup lang="ts">
import { computed } from "vue";
import { items, type Item } from "../game/types";
import { canAssignQuickSlot, quickSlotNumbers, useConstruction } from "../stores/construction";
import { useGame } from "../stores/game";

const props = defineProps<{ item: Item }>();
const g = useGame();
const b = useConstruction();
const assignableSlots = quickSlotNumbers.slice(1);
const assigned = computed(() => assignableSlots.find((slot) => g.state.quickSlots?.[slot] === props.item) ?? 0);

function assign(event: Event) {
  b.assignQuickSlot(Number((event.target as HTMLSelectElement).value), props.item);
}
function slotLabel(slot: number) {
  const item = g.state.quickSlots?.[slot];
  return `${slot} · ${item ? items[item]?.name ?? "Vazio" : "Vazio"}`;
}
</script>

<template>
  <label v-if="canAssignQuickSlot(item)" class="quick-slot-picker">
    Slot rápido
    <select :value="assigned" :aria-label="`Slot rápido para ${items[item].name}`" @change="assign">
      <option :value="0">Sem slot</option>
      <option v-for="slot in assignableSlots" :key="slot" :value="slot">
        {{ slotLabel(slot) }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.quick-slot-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-slot-picker select {
  max-width: 100%;
}

@media (pointer: coarse), (max-width: 760px) {
  .quick-slot-picker {
    display: none;
  }
}
</style>
