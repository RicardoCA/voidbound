<script setup lang="ts">
import ItemIcon from "./ItemIcon.vue";
import { computed } from "vue";
import { useGame } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { items } from "../game/types";
const g = useGame(),
  b = useConstruction();
const error = computed(
  () =>
    b.lastError ||
    (b.cursor && !b.removing ? b.errorAt(b.cursor.x, b.cursor.y) : undefined),
);
</script>
<template>
  <div
    v-if="b.enabled && !g.panel && !g.paused && g.state.mode === 'surface'"
    class="build-toolbar"
    role="toolbar"
    aria-label="Ferramentas de construção"
  >
    <button
      class="build-picker"
      aria-label="Escolher peça de construção"
      @click="b.openPalette"
    >
      <ItemIcon :item="b.selected" />
      <div>
        <b>{{ items[b.selected].name }}</b
        ><small>{{
          b.removing
            ? "DESMONTAR"
            : `${b.selectedCount} disponíveis · Escolher peça`
        }}</small>
      </div>
    </button>
    <button
      :class="{ active: b.removing }"
      :aria-pressed="b.removing"
      aria-label="Alternar desmontagem"
      title="Desmontar e recuperar peça"
      @click="b.removing = !b.removing"
    >
      ⌫
    </button>
    <button
      aria-label="Inverter escada"
      title="Inverter escada (R)"
      :disabled="b.selected !== 'woodStairs'"
      @click="b.rotate"
    >
      {{ b.facing === 1 ? "↗" : "↖" }}
    </button>
    <button
      aria-label="Sair da construção"
      title="Sair da construção (B)"
      @click="b.disable"
    >
      ×
    </button>
    <span v-if="error" class="build-feedback" aria-live="polite">{{
      error
    }}</span>
  </div>
</template>
