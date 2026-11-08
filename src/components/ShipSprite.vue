<script setup lang="ts">
import { shipModels } from "../fleet/models";
import { shipTextureUrl } from "../fleet/shipTextures";
import type { ShipModelId } from "../game/types";
defineProps<{ model: ShipModelId }>();
</script>
<template>
  <img
    class="ship-preview"
    :src="shipTextureUrl(shipModels[model].hullFamily)"
    :alt="shipModels[model].name"
    loading="lazy"
    decoding="async"
  />
</template>
