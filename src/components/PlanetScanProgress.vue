<script setup lang="ts">
import { PLANET_SCAN_SECONDS, useGame } from "../stores/game";

const g = useGame();
</script>

<template>
  <div v-if="g.planetScan" class="planet-scan">
    <span>Escaneando {{ g.planetScan.name }}</span>
    <progress
      :aria-label="`Escaneando ${g.planetScan.name}`"
      :value="g.planetScan.elapsed"
      :max="PLANET_SCAN_SECONDS"
    />
    <small
      >{{
        Math.floor((g.planetScan.elapsed / PLANET_SCAN_SECONDS) * 100)
      }}%</small
    >
  </div>
</template>

<style scoped>
.planet-scan {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px 8px;
  width: min(240px, 60vw);
  text-align: left;
}

.planet-scan > span {
  grid-column: 1 / -1;
}

.planet-scan progress {
  width: 100%;
  height: 6px;
  accent-color: #9be1d9;
}
</style>
