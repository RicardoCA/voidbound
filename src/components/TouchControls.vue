<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { flight3D } from "../game/rendering/flight3D";
import { useGame } from "../stores/game";
import {
  controls,
  setTouchSteering,
  pressControl,
  releaseControls,
  type Control,
} from "../game/input";
const g = useGame(),
  surface = computed(() => g.state.mode === "surface");
const station = computed(() => g.state.mode === "docked");
const cabin = computed(() => g.state.mode === "interior" || g.flightCabin);
const indoors = computed(() => station.value || cabin.value);
const walking = computed(
  () => surface.value || indoors.value || g.aboardColossal,
);
const piloting = computed(() => !walking.value || g.colossalHelm);
const x = ref(0),
  y = ref(0),
  active = ref(false);
let stickPointer: number | undefined;
let walkPointer: number | undefined;
const advancing = ref(false);
function startWalking(event: PointerEvent) {
  if (walkPointer !== undefined) return;
  event.preventDefault();
  walkPointer = event.pointerId;
  advancing.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  controls.up = true;
}
function stopWalking(event?: PointerEvent) {
  if (event && event.pointerId !== walkPointer) return;
  walkPointer = undefined;
  advancing.value = false;
  controls.up = false;
}
const directions: Control[] = ["left", "right", "up", "down"];
function resetStick() {
  stickPointer = undefined;
  active.value = false;
  x.value = 0;
  y.value = 0;
  setTouchSteering(0);
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
  setTouchSteering(piloting.value ? dx / radius : 0);
  controls.left = !piloting.value && dx < -radius * 0.28;
  controls.right = !piloting.value && dx > radius * 0.28;
  controls.up = dy < -radius * 0.28;
  controls.down = dy > radius * 0.28;
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
  stopWalking();
  resetStick();
  releaseControls();
}
watch(() => [g.state.mode, g.panel, g.paused, flight3D.surfaceView, piloting.value], reset, { flush: "sync" });
onMounted(() => {
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", reset);
});
onBeforeUnmount(() => {
  reset();
  window.removeEventListener("blur", reset);
  document.removeEventListener("visibilitychange", reset);
});
</script>
<template>
  <div class="touch-controls" aria-label="Controles de toque">
    <div class="touch-movement">
      <button
        v-if="surface || piloting"
        class="touch-walk"
        :class="{ active: advancing }"
        :aria-label="piloting ? 'Segure para acelerar a nave' : 'Segure para andar para a frente'"
        :aria-pressed="advancing"
        @pointerdown="startWalking"
        @pointerup="stopWalking"
        @pointercancel="stopWalking"
        @lostpointercapture="stopWalking"
        @touchend.prevent
        @dblclick.prevent
        @contextmenu.prevent
      >
        <span aria-hidden="true">↑</span>
        {{ piloting ? "ACELERAR" : "ANDAR" }}
      </button>
      <div
        v-else
        class="touch-stick"
        :class="{ active }"
        role="group"
        :aria-label="
          walking ? 'Joystick de movimento' : 'Joystick de pilotagem'
        "
        @pointerdown="start"
        @touchend.prevent
        @dblclick.prevent
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
      <span v-if="piloting" class="touch-hint"
        >ARRASTE A TELA PARA VIRAR</span
      >
    </div>
    <div
      class="touch-actions"
      :class="{ 'space-actions': piloting, 'station-actions-only': indoors && !piloting }"
    >
      <button
        v-if="piloting"
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
        v-else-if="surface"
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
        v-if="piloting"
        class="touch-mine"
        aria-label="Minerar asteroides ou extrair cristal estelar"
        @pointerdown="action('mine', $event)"
        @pointerup="stop('mine', $event)"
        @pointercancel="stop('mine', $event)"
        @lostpointercapture="stop('mine', $event)"
      >
        <span aria-hidden="true">⌁</span>LASER
      </button>
      <button
        v-if="piloting"
        class="touch-fire"
        aria-label="Disparar arma"
        @pointerdown="action('fire', $event)"
        @pointerup="stop('fire', $event)"
        @pointercancel="stop('fire', $event)"
        @lostpointercapture="stop('fire', $event)"
      >
        ATIRAR
      </button>
      <button
        class="touch-interact"
        :aria-label="
          station
            ? 'Conversar com atendente'
            : cabin || g.aboardColossal
              ? 'Usar equipamento da nave'
              : surface
                ? 'Interagir na superfície'
                : g.flightContact?.wreck && g.flightContact.distance <= 95
                  ? 'Saquear destroço'
                  : g.stationDistance <= 115
                    ? 'Acoplar à estação'
                    : g.flightTarget.action === 'planet'
                      ? 'Escanear planeta'
                      : g.flightTarget.action === 'anomaly'
                        ? 'Escanear anomalia'
                        : g.flightTarget.action === 'orbit'
                          ? 'Entrar em órbita'
                          : 'Interagir no espaço'
        "
        @pointerdown="action('interact', $event)"
        @pointerup="stop('interact', $event)"
        @pointercancel="stop('interact', $event)"
        @lostpointercapture="stop('interact', $event)"
      >
        {{
          station
            ? "CONVERSAR"
            : cabin || surface || g.aboardColossal
              ? "INTERAGIR"
              : g.flightContact?.wreck && g.flightContact.distance <= 95
                ? "SAQUEAR"
                : g.stationDistance <= 115
                  ? "ACOPLAR"
                  : g.flightTarget.action && g.flightTarget.action !== "orbit"
                    ? "ESCANEAR"
                    : g.flightTarget.action === "orbit"
                      ? "ÓRBITA"
                      : "INTERAGIR"
        }}
      </button>
    </div>
  </div>
</template>
