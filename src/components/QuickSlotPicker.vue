<script setup lang="ts">
import { computed } from "vue";
import { items, type Item } from "../game/types";
import { assignableQuickSlots as assignableSlots, canAssignQuickSlot } from "../inventory/quickSlots";
import { useConstruction } from "../stores/construction";
import { useGame } from "../stores/game";

const props = defineProps<{ item: Item }>();
const g = useGame();
const b = useConstruction();
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
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  color: #a8bdc7;
  font-size: 12px;
}

.quick-slot-picker select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid #38515f;
  background: #111e2b;
  color: #deefeb;
  font: inherit;
  text-overflow: ellipsis;
}

@media (pointer: coarse), (max-width: 760px) {
  .quick-slot-picker select {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
