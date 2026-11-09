<script setup lang="ts">
const amount = defineModel<"1" | "10" | "all">({ required: true });
</script>

<template>
  <div
    class="storage-amount"
    role="group"
    aria-label="Quantidade por transferência"
  >
    <span>TRANSFERIR</span>
    <button
      v-for="option in ['1', '10', 'all'] as const"
      :key="option"
      type="button"
      :aria-pressed="amount === option"
      :class="{ active: amount === option }"
      @click="amount = option"
    >
      {{ option === "all" ? "Todos" : option }}
    </button>
  </div>
</template>
