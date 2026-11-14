<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import Phaser from "phaser";
import StationPanel from "./StationPanel.vue";
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
const use3D = ref(true);
const gpuFailed = ref(false);
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
const inColossal = computed(
  () => props.playing && g.aboardColossal && !g.colossalHelm && !g.busy,
);
const surfaceCinematic = computed(() => !!g.surfaceSequence);
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
      !!g.dockingSequence) &&
    use3D.value &&
    !gpuFailed.value,
);
let space: Space3D | undefined;
let frame = 0;
watch(
  [
    spaceCanvas,
    show3D,
    freeFlight,
    inColossal,
    lightJump,
    () => g.dockingSequence?.kind,
  ],
  () => {
    cancelAnimationFrame(frame);
    flight3D.enabled = false;
    flight3D.stationView = false;
    flight3D.colossalView = false;
    flight3D.reset();
    if (!spaceCanvas.value || !show3D.value) return;
    try {
      space ??= new Space3D(spaceCanvas.value);
      flight3D.enabled = freeFlight.value;
      flight3D.stationView = inStation.value;
      flight3D.colossalView = inColossal.value;
      const startedAt = performance.now();
      const draw = () => {
        if (lightJump.value)
          space!.drawJump(
            (performance.now() - startedAt) /
              (g.colossalJumpMs ?? JUMP_DURATION_MS),
          );
        else if (surfaceCinematic.value) space!.drawSurfaceCinematic(g);
        else if (landingComputer.value) space!.drawLandingComputer(g.planet);
        else if (inCabin.value)
          space!.drawCabin(g.flightCabin, g.state.wardrobe?.equipped);
        else if (inColossal.value) {
          if (flight3D.colossalBoarding) space!.draw(g);
          else space!.drawColossalInterior(g);
        } else if (inStation.value) space!.drawStationInterior(g);
        else space!.draw(g);
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
  cancelAnimationFrame(frame);
  flight3D.enabled = false;
  flight3D.stationView = false;
  flight3D.colossalView = false;
  flight3D.reset();
  space?.destroy();
  observer?.disconnect();
  media?.removeEventListener("change", resize);
  game?.destroy(true);
});
</script>
<template>
  <div ref="host" class="game-canvas" aria-label="Universo de Voidbound">
    <canvas
      ref="spaceCanvas"
      v-show="show3D"
      class="space-3d"
      :class="{
        'light-jump-3d': lightJump && show3D,
        'landing-computer-3d': landingComputer && show3D,
      }"
      aria-label="Visão 3D do jogo"
      @webglcontextlost="
        gpuFailed = true;
        use3D = false;
      "
    />
    <button
      v-if="
        (freeFlight || inCabin || inStation) &&
        !gpuFailed &&
        !g.panel &&
        !g.paused
      "
      type="button"
      class="space-view-toggle"
      @click="use3D = !use3D"
    >
      {{ use3D ? "Vista 2D" : "Vista 3D" }}
    </button>
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
.space-view-toggle {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  padding: 7px 10px;
  font-size: 11px;
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
