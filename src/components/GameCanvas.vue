<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import Phaser from "phaser";
import PlanetGovernmentPanel from "./PlanetGovernmentPanel.vue";
import { useGame } from "../stores/game";
const g = useGame();
import { WorldScene } from "../game/scenes/WorldScene";
import { MOBILE_LAYOUT, logicalViewport } from "../game/rendering/viewport";
const props = defineProps<{ playing: boolean }>();
const host = ref<HTMLDivElement>();
let game: Phaser.Game | undefined,
  observer: ResizeObserver | undefined,
  media: MediaQueryList | undefined;
function resize() {
  if (!game || !host.value) return;
  const box = host.value.getBoundingClientRect();
  const size = logicalViewport(
    box.width,
    box.height,
    !!media?.matches && props.playing,
  );
  if (game.scale.width !== size.width || game.scale.height !== size.height)
    game.scale.setGameSize(size.width, size.height);
  game.scale.setParentSize(box.width, box.height);
}
watch(
  () => props.playing,
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
  observer?.disconnect();
  media?.removeEventListener("change", resize);
  game?.destroy(true);
});
</script>
<template>
  <div ref="host" class="game-canvas" aria-label="Universo de Voidbound">
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
