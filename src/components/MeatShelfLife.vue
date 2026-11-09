<script setup lang="ts">
import { computed } from "vue";
import type { Inventory } from "../game/types";
import { meatShelfLife } from "../survival/perishables";

const props = defineProps<{
  inventory: Inventory;
  time: number;
  inFridge?: boolean;
  paused?: boolean;
}>();
const life = computed(() =>
  meatShelfLife(props.inventory, props.time, props.inFridge),
);
</script>

<template>
  <span v-if="life" class="shelf-life" :class="{ refrigerated: paused }">
    <template v-if="paused">
      <span>Refrigerada · validade pausada</span>
      <span>Tempo restante quando voltar a contar · {{ life.label }}</span>
    </template>
    <template v-else>
      <span>Próximo vencimento · {{ life.label }}</span>
      <span class="shelf-life-track" aria-hidden="true">
        <span :style="{ width: life.percent + '%' }" />
      </span>
    </template>
  </span>
</template>

<style scoped>
.shelf-life {
  display: grid;
  gap: 4px;
  color: #d7b686;
  font-size: 0.72rem;
  line-height: 1.3;
  letter-spacing: normal;
}

.shelf-life.refrigerated {
  color: #9be1d9;
}

.shelf-life-track {
  display: block;
  height: 3px;
  background: #263744;
}

.shelf-life-track > span {
  display: block;
  height: 100%;
  background: #d7b686;
}
</style>
