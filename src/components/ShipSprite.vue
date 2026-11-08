<script setup lang="ts">
import { computed } from "vue";
import { shipModels } from "../fleet/models";
import { shipArt } from "../fleet/shipArt";
import type { ShipModelId } from "../game/types";
const props = defineProps<{ model: ShipModelId }>();
const art = computed(() => {
  const { hull, details } = shipArt(props.model);
  return [hull, details].map((plates) => {
    const paths = new Map<number, string>();
    for (const { x, y, w, h, color } of plates) {
      paths.set(
        color,
        (paths.get(color) ?? "") + `M${x} ${y}h${w}v${h}h-${w}z`,
      );
    }
    return paths;
  });
});
</script>
<template>
  <svg
    class="ship-preview"
    viewBox="-4 -3 53 39"
    role="img"
    :aria-label="shipModels[model].name"
    shape-rendering="crispEdges"
  >
    <g v-for="(layer, i) in art" :key="i">
      <path
        v-for="[color, path] in layer"
        :key="color"
        :d="path"
        :fill="'#' + color.toString(16).padStart(6, '0')"
      />
    </g>
  </svg>
</template>
