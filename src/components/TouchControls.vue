<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import {
  controls,
  pressControl,
  releaseControls,
  type Control,
} from "../game/input";
const b = useConstruction();
const g = useGame(),
  surface = computed(() => g.state.mode === "surface");
const x = ref(0),
  y = ref(0),
  active = ref(false);
let stickPointer: number | undefined;
const directions: Control[] = ["left", "right", "up", "down"];
function resetStick() {
  stickPointer = undefined;
  active.value = false;
  x.value = 0;
  y.value = 0;
  for (const id of directions) controls[id] = false;
}
function move(event: PointerEvent) {
  if (event.pointerId !== stickPointer) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  let dx = event.clientX - rect.left - rect.width / 2,
    dy = event.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(dx, dy),
    radius = rect.width * 0.32;
  if (length > radius) {
    dx = (dx / length) * radius;
    dy = (dy / length) * radius;
  }
  x.value = dx;
  y.value = dy;
  controls.left = dx < -radius * 0.28;
  controls.right = dx > radius * 0.28;
  controls.up = !surface.value && dy < -radius * 0.28;
  controls.down = !surface.value && dy > radius * 0.28;
}
function start(event: PointerEvent) {
  if (stickPointer !== undefined) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  active.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  move(event);
}
function end(event: PointerEvent) {
  if (event.pointerId === stickPointer) resetStick();
}
function action(id: Control, event: PointerEvent) {
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pressControl(id);
}
function stop(id: Control, event: PointerEvent) {
  event.preventDefault();
  controls[id] = false;
}
function reset() {
  resetStick();
  releaseControls();
}
watch(() => [g.state.mode, g.panel, g.paused], reset, { flush: "sync" });
onBeforeUnmount(reset);
</script>
<template>
  <div class="touch-controls" aria-label="Controles de toque">
    <div class="touch-movement">
      <div
        class="touch-stick"
        :class="{ active }"
        role="group"
        :aria-label="
          surface ? 'Joystick de movimento' : 'Joystick de pilotagem'
        "
        @pointerdown="start"
        @pointermove="move"
        @pointerup="end"
        @pointercancel="end"
        @lostpointercapture="end"
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M45 13L50 8L55 13M13 45L8 50L13 55M45 87L50 92L55 87M87 45L92 50L87 55"
          />
        </svg>
        <span
          class="touch-stick-knob"
          :style="{ transform: `translate(${x}px, ${y}px)` }"
        />
      </div>
      <span class="touch-hint">{{
        surface ? "MOVER" : "GIRAR / ACELERAR"
      }}</span>
    </div>
    <div class="touch-actions">
      <button
        v-if="!surface"
        class="touch-brake"
        aria-label="Frear nave"
        @pointerdown="action('down', $event)"
        @pointerup="stop('down', $event)"
        @pointercancel="stop('down', $event)"
        @lostpointercapture="stop('down', $event)"
      >
        FREAR
      </button>
      <button
        v-else
        class="touch-jump"
        aria-label="Pular"
        @pointerdown="action('jump', $event)"
        @pointerup="stop('jump', $event)"
        @pointercancel="stop('jump', $event)"
        @lostpointercapture="stop('jump', $event)"
      >
        PULAR
      </button>
      <button
        class="touch-mine"
        :aria-label="
          b.enabled
            ? 'Aplicar construção'
            : surface
              ? 'Minerar blocos'
              : 'Minerar asteroides'
        "
        @pointerdown="action('mine', $event)"
        @pointerup="stop('mine', $event)"
        @pointercancel="stop('mine', $event)"
        @lostpointercapture="stop('mine', $event)"
      >
        <span aria-hidden="true">⌁</span
        >{{
          b.enabled
            ? b.removing
              ? "REMOVER"
              : "COLOCAR"
            : surface
              ? "MINERAR"
              : "LASER"
        }}
      </button>
      <button
        class="touch-interact"
        :aria-label="
          surface ? 'Interagir com porta, nave ou armário' : 'Entrar em órbita'
        "
        @pointerdown="action('interact', $event)"
        @pointerup="stop('interact', $event)"
        @pointercancel="stop('interact', $event)"
        @lostpointercapture="stop('interact', $event)"
      >
        {{ surface ? "INTERAGIR" : "ÓRBITA" }}
      </button>
    </div>
  </div>
</template>
