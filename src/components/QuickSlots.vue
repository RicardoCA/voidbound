<script setup lang="ts">
import { computed } from "vue";
import ItemIcon from "./ItemIcon.vue";
import { items } from "../game/types";
import { canAssignQuickSlot, quickSlotNumbers, useConstruction } from "../stores/construction";
import { useGame } from "../stores/game";

const b = useConstruction();
const g = useGame();
const slots = computed(() => quickSlotNumbers.map((number) => {
  const stored = number === 1 ? undefined : g.state.quickSlots?.[number];
  const item = stored && canAssignQuickSlot(stored) ? stored : undefined;
  const name = number === 1 ? "Pistola de mineração" : item ? items[item].name : "Vazio";
  return { number, item, name, count: item ? (g.state.backpack[item] ?? 0) : undefined };
}));
</script>

<template>
  <div class="quick-slots" role="group" aria-label="Slots rápidos">
    <button
      v-for="{ number, item, name, count } in slots"
      :key="number"
      type="button"
      :class="{ 'is-empty': number > 1 && !item, depleted: count === 0 }"
      :aria-pressed="b.activeQuickSlot === number"
      :aria-label="`Slot ${number} · ${name}${count === undefined ? '' : ` · ${count} na mochila`}`"
      :title="`${number} · ${name}`"
      :disabled="!!g.panel || g.paused || g.busy"
      @click="b.activateQuickSlot(number)"
    >
      <kbd>{{ number }}</kbd>
      <ItemIcon v-if="number === 1" item="drill" />
      <ItemIcon v-else-if="item" :item="item" />
      <span v-if="count !== undefined">{{ count }}</span>
    </button>
  </div>
</template>

<style scoped>
.quick-slots {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid #294250;
  background: #09131c;
}

.quick-slots button {
  position: relative;
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  min-height: 0;
  padding: 0;
  border: 1px solid #304653;
  border-radius: 2px;
  background: #132430;
}

.quick-slots button.is-empty {
  background: #0d1a25;
}

.quick-slots button[aria-pressed="true"] {
  border-color: #96dfca;
  background: #1f3a40;
  box-shadow: inset 0 0 0 1px #517c74;
}

.quick-slots button:focus-visible {
  outline: 2px solid #c8ffee;
  outline-offset: 2px;
}

.quick-slots button.depleted :deep(.item-art) {
  opacity: .42;
}

.quick-slots kbd,
.quick-slots button > span {
  position: absolute;
  padding: 0;
  margin: 0;
  line-height: 1;
  font-size: 9px;
  border: 0;
  background: none;
  text-shadow: 0 1px 2px #02070d;
}

.quick-slots kbd {
  top: 3px;
  left: 3px;
  color: #9db7c2;
}

.quick-slots button > span {
  bottom: 3px;
  right: 3px;
  color: #deefeb;
}

.quick-slots :deep(.item-art) {
  width: 25px;
  height: 25px;
}

@media (pointer: coarse), (max-width: 760px) {
  .quick-slots {
    display: none;
  }
}
</style>
