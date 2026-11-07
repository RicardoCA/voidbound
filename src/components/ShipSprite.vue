<script setup lang="ts">
import { computed } from "vue";
import { shipModels, shipPalette } from "../fleet/models";
import type { ShipModelId } from "../game/types";
const props = defineProps<{ model: ShipModelId }>();
const pixels = computed(() =>
  shipModels[props.model].sprite.flatMap((row, y) =>
    [...row].flatMap((key, x) =>
      key === "."
        ? []
        : [{ x, y, color: shipPalette[key as keyof typeof shipPalette] }],
    ),
  ),
);
</script>
<template>
  <svg
    class="ship-preview"
    viewBox="0 0 17 13"
    role="img"
    :aria-label="shipModels[model].name"
    shape-rendering="crispEdges"
  >
    <rect
      v-for="pixel in pixels"
      :key="pixel.y * 15 + pixel.x"
      :x="pixel.x + 1"
      :y="pixel.y + 1"
      width="1"
      height="1"
      :fill="'#' + pixel.color.toString(16)"
    />
  </svg>
</template>
