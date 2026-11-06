<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import Phaser from "phaser";
import { WorldScene } from "../game/scenes/WorldScene";
const host = ref<HTMLDivElement>();
let game: Phaser.Game | undefined;
onMounted(() => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host.value,
    width: 480,
    height: 270,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#080f20",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { debug: false } },
    scene: [WorldScene],
    audio: { noAudio: true },
  });
});
onBeforeUnmount(() => game?.destroy(true));
</script>
<template>
  <div ref="host" class="game-canvas" aria-label="Universo de Voidbound" />
</template>
