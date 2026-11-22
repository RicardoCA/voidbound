<script setup lang="ts">
import { computed } from "vue";
import ItemIcon from "./ItemIcon.vue";
import { items } from "../game/types";
import { canAssignQuickSlot, quickSlotNumbers } from "../inventory/quickSlots";
import { useConstruction } from "../stores/construction";
import { useGame } from "../stores/game";

defineProps<{ touch?: boolean }>();
const b = useConstruction();
const g = useGame();
const slots = computed(() => quickSlotNumbers.map((number) => {
  const stored = number === 1 ? undefined : g.state.quickSlots?.[number];
  const item = stored && canAssignQuickSlot(stored) ? stored : undefined;
  const name = number === 1 ? "Pistola de mineração" : item ? items[item].name : "Vazio";
  return { number, item, name, count: item ? (g.state.backpack[item] ?? 0) : undefined };
}));
const groups = computed(() => [slots.value.slice(0, 1), slots.value.slice(1)]);

let swipe: { id: number; x: number; scroll: number; moved: boolean } | undefined;

function startSwipe(event: PointerEvent) {
  const track = event.currentTarget as HTMLElement;
  if (event.pointerType !== "touch" || swipe || track.scrollWidth <= track.clientWidth) return;
  swipe = { id: event.pointerId, x: event.clientX, scroll: track.scrollLeft, moved: false };
}

function moveSwipe(event: PointerEvent) {
  if (event.pointerId !== swipe?.id) return;
  const track = event.currentTarget as HTMLElement;
  const distance = swipe.x - event.clientX;
  if (!swipe.moved) {
    if (Math.abs(distance) < 7) return;
    swipe.moved = true;
    track.setPointerCapture(event.pointerId);
  }
  track.scrollLeft = swipe.scroll + distance;
}

function endSwipe(event: PointerEvent) {
  if (event.pointerId === swipe?.id) swipe = undefined;
}
</script>

<template>
  <div class="quick-slots" :class="{ 'quick-slots--touch': touch }" role="group" aria-label="Slots rápidos">
    <div
      v-for="(group, index) in groups"
      :key="index"
      class="quick-slots-track"
      :class="{ scrollable: index === 1 }"
      @pointerdown="startSwipe"
      @pointermove="moveSwipe"
      @pointerup="endSwipe"
      @pointercancel="endSwipe"
      @lostpointercapture.self="endSwipe"
    >
      <button
        v-for="{ number, item, name, count } in group"
        :key="number"
        type="button"
        :class="{ 'is-empty': number > 1 && !item }"
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

.quick-slots-track {
  display: flex;
  gap: 3px;
}

.quick-slots--touch {
  display: none;
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
  .quick-slots:not(.quick-slots--touch) {
    display: none;
  }

  .quick-slots--touch {
    display: flex;
    width: max-content;
    max-width: 100%;
    border-radius: 7px;
    background: #09131ce8;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
  }

  .quick-slots--touch .scrollable {
    min-width: 0;
    overflow-x: auto;
    touch-action: none;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: #517c74 transparent;
  }

  .quick-slots--touch button {
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
  }

  .quick-slots--touch button:focus-visible {
    outline-offset: -3px;
  }
}
</style>
