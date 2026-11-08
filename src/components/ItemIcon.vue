<script setup lang="ts">
import { computed } from "vue";
import { items, type Item } from "../game/types";
import { itemArt } from "../inventory/itemArt";

const props = defineProps<{ item: Item }>();
const art = computed(() => itemArt[props.item]);
</script>
<template>
  <svg
    class="item-art"
    viewBox="0 0 24 24"
    aria-hidden="true"
    shape-rendering="crispEdges"
  >
    <path
      :d="art.body"
      :fill="items[item].color"
      stroke="#071323"
      stroke-width="2"
    />
    <path :d="art.shade" fill="#101d30" opacity=".52" />
    <path :d="art.light" fill="#fff4d4" opacity=".66" />
    <path v-if="art.detail" :d="art.detail" :fill="art.accent ?? '#b0f7da'" />
  </svg>
</template>

<style scoped>
.item-art {
  display: block;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
}
</style>
