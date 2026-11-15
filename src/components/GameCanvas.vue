<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import Phaser from "phaser";
import StationPanel from "./StationPanel.vue";
import DealershipPanel from "./DealershipPanel.vue";
import { shipModels } from "../fleet/models";
import { releaseControls } from "../game/input";
import { stationServicesFor } from "../game/station/services";
import PlanetGovernmentPanel from "./PlanetGovernmentPanel.vue";
import { JUMP_DURATION_MS, useGame } from "../stores/game";
const g = useGame();
const stationNpc = computed(() =>
  g.state.mode === "docked"
    ? stationServicesFor(g.system.station?.kind === "clandestine").find(
        (npc) => g.panel === "station:" + npc.id,
      )
    : undefined,
);
import { flight3D } from "../game/rendering/flight3D";
import { Space3D } from "../game/rendering/Space3D";
import { WorldScene } from "../game/scenes/WorldScene";
import { MOBILE_LAYOUT, logicalViewport } from "../game/rendering/viewport";
const props = defineProps<{ playing: boolean; expanded?: boolean }>();
const host = ref<HTMLDivElement>();
const spaceCanvas = ref<HTMLCanvasElement>();
const use3D = computed(() => g.betaMode);
const gpuFailed = ref(false);
watch(
  [use3D, gpuFailed],
  () => {
    flight3D.selected = use3D.value && !gpuFailed.value;
  },
  { immediate: true },
);
const freeFlight = computed(
  () =>
    props.playing &&
    g.state.mode === "space" &&
    !g.flightCabin &&
    (!g.aboardColossal || g.colossalHelm) &&
    !g.inSequence &&
    !g.busy,
);
const inCabin = computed(
  () =>
    props.playing &&
    !g.aboardColossal &&
    (g.flightCabin || g.state.mode === "interior") &&
    !g.inSequence &&
    !g.busy,
);
const inStation = computed(
  () => props.playing && g.state.mode === "docked" && !g.dockingSequence,
);
const inShowroom = computed(() => inStation.value && g.showroom);
function leaveShowroom() {
  releaseControls();
  g.showroom = false;
  g.showroomContact = undefined;
  if (g.panel.startsWith("showroom:")) g.panel = "";
}
watch([inStation, gpuFailed, use3D], ([atStation, failed, enabled]) => {
  if (g.showroom && (!atStation || failed || !enabled)) leaveShowroom();
});
const inColossal = computed(
  () => props.playing && g.aboardColossal && !g.colossalHelm && !g.busy,
);
const routeComputer = computed(
  () => freeFlight.value && !g.aboardColossal && g.panel === "route" && !g.paused,
);
const routeComputerReady = ref(false);
const surfaceCinematic = computed(() => !!g.surfaceSequence);
const surfaceExploration = computed(
  () => props.playing && g.state.mode === "surface" && !g.inSequence && !g.busy,
);
const mouseLocked = ref(false);
const surfaceControls = computed(
  () => surfaceExploration.value && show3D.value && !g.paused && !g.panel,
);
function lockSurfaceMouse() {
  const canvas = game?.canvas;
  if (!canvas?.requestPointerLock) return;
  void Promise.resolve(canvas.requestPointerLock()).catch(() => {
    g.notify("Segure o botão direito e arraste para olhar ao redor.");
  });
}
function onPointerLock() {
  mouseLocked.value = document.pointerLockElement === game?.canvas;
  if (mouseLocked.value && !surfaceControls.value) document.exitPointerLock();
}
const landingComputer = computed(
  () => props.playing && g.state.mode === "orbit" && !g.inSequence && !g.busy,
);
const lightJump = computed(() => g.busy && !g.blackHoleTransit);
const show3D = computed(
  () =>
    (freeFlight.value ||
      inCabin.value ||
      inStation.value ||
      inColossal.value ||
      lightJump.value ||
      landingComputer.value ||
      surfaceCinematic.value ||
      surfaceExploration.value ||
      !!g.dockingSequence) &&
    use3D.value &&
    !gpuFailed.value,
);
watch(surfaceControls, (available) => {
  if (!available && mouseLocked.value) document.exitPointerLock();
});
let space: Space3D | undefined;
let frame = 0;
let cabinPreload = 0;
const cabinLoading = ref(false);
watch(
  [
    spaceCanvas,
    show3D,
    freeFlight,
    inColossal,
    lightJump,
    surfaceExploration,
    () => g.dockingSequence?.kind,
  ],
  () => {
    cancelAnimationFrame(frame);
    clearTimeout(cabinPreload);
    cabinLoading.value = false;
    routeComputerReady.value = false;
    flight3D.enabled = false;
    flight3D.stationView = false;
    flight3D.surfaceView = false;
    flight3D.surface = undefined;
    flight3D.surfacePointer = undefined;
    flight3D.colossalView = false;
    flight3D.reset();
    if (!spaceCanvas.value || !show3D.value) return;
    try {
      space ??= new Space3D(spaceCanvas.value);
      flight3D.enabled = freeFlight.value;
      flight3D.stationView = inStation.value;
      flight3D.surfaceView = surfaceExploration.value;
      if (surfaceExploration.value)
        flight3D.surfacePointer = (x, y, snap, pickPreview) => space?.surfacePointAt(x, y, snap, pickPreview);
      flight3D.colossalView = inColossal.value;
      if (freeFlight.value && !g.aboardColossal)
        cabinPreload = window.setTimeout(
          () => space?.prepareCabin(g.state.wardrobe?.equipped),
          250,
        );
      const startedAt = performance.now();
      const draw = () => {
        if (lightJump.value)
          space!.drawJump(
            (performance.now() - startedAt) /
              (g.colossalJumpMs ?? JUMP_DURATION_MS),
          );
        else if (surfaceCinematic.value) space!.drawSurfaceCinematic(g);
        else if (surfaceExploration.value) space!.drawSurfaceExploration(g);
        else if (landingComputer.value) space!.drawLandingComputer(g.planet);
        else if (routeComputer.value) {
          routeComputerReady.value = space!.drawRouteComputer();
          if (!routeComputerReady.value) space!.draw(g);
        } else if (inCabin.value)
          cabinLoading.value = !space!.drawCabin(g);
        else if (inColossal.value) {
          if (flight3D.colossalBoarding) space!.draw(g);
          else space!.drawColossalInterior(g);
        } else if (inShowroom.value) space!.drawShowroom(g);
        else if (inStation.value) space!.drawStationInterior(g);
        else space!.draw(g);
        if (!inCabin.value) cabinLoading.value = false;
        frame = requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      console.warn("Voidbound: visão 3D indisponível", error);
      gpuFailed.value = true;
      flight3D.enabled = false;
      flight3D.stationView = false;
      flight3D.colossalView = false;
    }
  },
  { flush: "post" },
);
let game: Phaser.Game | undefined,
  observer: ResizeObserver | undefined,
  media: MediaQueryList | undefined;
function resize() {
  if (!game || !host.value) return;
  const box = host.value.getBoundingClientRect();
  const size = logicalViewport(
    box.width,
    box.height,
    props.playing && (!!media?.matches || props.expanded === true),
  );
  if (game.scale.width !== size.width || game.scale.height !== size.height)
    game.scale.setGameSize(size.width, size.height);
  game.scale.setParentSize(box.width, box.height);
}
watch(
  () => [props.playing, props.expanded],
  () => requestAnimationFrame(resize),
  { flush: "post" },
);
onMounted(() => {
  document.addEventListener("pointerlockchange", onPointerLock);
  media = window.matchMedia(MOBILE_LAYOUT);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host.value,
    width: 480,
    height: 270,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#080f20",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    physics: { default: "arcade", arcade: { debug: false } },
    scene: [WorldScene],
    audio: { noAudio: true },
  });
  observer = new ResizeObserver(resize);
  observer.observe(host.value!);
  media.addEventListener("change", resize);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerlockchange", onPointerLock);
  if (mouseLocked.value) document.exitPointerLock();
  clearTimeout(cabinPreload);
  cancelAnimationFrame(frame);
  flight3D.selected = false;
  flight3D.enabled = false;
  flight3D.stationView = false;
  flight3D.surfaceView = false;
  flight3D.surface = undefined;
  flight3D.surfacePointer = undefined;
  flight3D.colossalView = false;
  flight3D.reset();
  space?.destroy();
  observer?.disconnect();
  media?.removeEventListener("change", resize);
  game?.destroy(true);
});
</script>
<template>
  <div ref="host" class="game-canvas" :class="{ 'surface-first-person': surfaceControls }" aria-label="Universo de Voidbound">
    <canvas
      ref="spaceCanvas"
      v-show="show3D && (!surfaceExploration || !!flight3D.surface)"
      class="space-3d"
      :class="{
        'light-jump-3d': lightJump && show3D,
        'landing-computer-3d': landingComputer && show3D,
        'route-computer-3d': routeComputer && routeComputerReady && show3D,
      }"
      aria-label="Visão 3D do jogo"
      @webglcontextlost="
        gpuFailed = true;
      "
    />
    <div v-if="surfaceControls" class="surface-reticle" aria-hidden="true">+</div>
    <button
      v-if="surfaceControls && !mouseLocked"
      type="button"
      class="secondary surface-mouse-lock"
      @click="lockSurfaceMouse"
    >
      Controlar câmera
    </button>
    <div v-if="inCabin && show3D && cabinLoading" class="cabin-loading" role="status">
      Carregando cabine…
    </div>
    <div
      v-if="
        freeFlight &&
        use3D &&
        !gpuFailed &&
        !g.panel &&
        !g.paused &&
        !g.colossalHelm
      "
      class="pitch-controls"
    >
      <button
        v-for="[label, direction] in [
          ['Subir', 1],
          ['Descer', -1],
        ] as const"
        :key="direction"
        type="button"
        @pointerdown.prevent="
          ($event.currentTarget as HTMLElement).setPointerCapture(
            $event.pointerId,
          );
          flight3D.touchPitch = direction;
        "
        @lostpointercapture="flight3D.touchPitch = 0"
      >
        {{ label }}
      </button>
    </div>
    <div v-if="inShowroom && !g.paused && !g.panel" class="showroom-controls">
      <button type="button" class="secondary" @click="leaveShowroom">
        Voltar à estação
      </button>
      <button
        v-if="g.showroomContact"
        type="button"
        class="primary"
        @click="releaseControls(); g.panel = 'showroom:ship'"
      >
        Ver ficha · {{ shipModels[g.showroomContact].name }}
      </button>
    </div>
    <section
      v-if="inShowroom && g.panel === 'showroom:ship' && g.showroomContact && !g.paused"
      class="dialog showroom-details"
      aria-label="Ficha da nave em exposição"
    >
      <button
        type="button"
        class="secondary"
        :disabled="g.trading"
        @click="g.panel = ''"
      >
        Voltar à exposição
      </button>
      <DealershipPanel :key="g.showroomContact" :preview-model="g.showroomContact" />
      <p v-if="g.notice" role="status">{{ g.notice }}</p>
    </section>
    <StationPanel
      v-if="stationNpc && !g.paused && !g.busy"
      :key="stationNpc.id"
      :npc="stationNpc"
    />
    <PlanetGovernmentPanel
      v-if="
        g.panel === 'government' &&
        g.state.mode === 'surface' &&
        g.civilization &&
        !g.paused
      "
    />
  </div>
</template>

<style scoped>
.space-3d {
  z-index: 1;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.surface-first-person :deep(canvas) {
  touch-action: none;
}
.surface-reticle {
  position: absolute;
  z-index: 2;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  color: white;
  font: bold 22px monospace;
  text-shadow: 0 1px 3px #06101f;
  pointer-events: none;
}
.surface-mouse-lock {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 86px;
  min-height: 32px;
}
@media (pointer: coarse) {
  .surface-mouse-lock { display: none; }
}
.showroom-controls {
  position: absolute;
  inset: 10px 12px auto;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  pointer-events: none;
}
.showroom-controls button {
  min-height: 44px;
  pointer-events: auto;
}
.dialog.showroom-details {
  position: absolute;
  z-index: 6;
  inset: 12px 12px auto auto;
  width: min(350px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  padding: 12px;
  overflow: auto;
}
@media (pointer: coarse), (max-width: 760px) {
  .showroom-controls,
  .dialog.showroom-details {
    top: calc(var(--mobile-hud-height, 110px) + 8px);
  }
  .dialog.showroom-details {
    max-height: calc(100% - var(--mobile-hud-height, 110px) - 20px);
  }
}
.cabin-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  background: #080f20;
  color: #a7dedb;
  pointer-events: none;
}
.pitch-controls {
  display: none;
}
@media (pointer: coarse), (max-width: 760px) {
  .pitch-controls {
    position: absolute;
    z-index: 2;
    right: 8px;
    top: 42px;
    display: flex;
    gap: 5px;
  }
  .pitch-controls button {
    touch-action: none;
    padding: 5px;
  }
}
</style>
