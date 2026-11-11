<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  anchor: { x: number; y: number; width: number; height: number };
  expanded: boolean;
  label: string;
}>();
const placement = computed(() => {
  const { x, y, width, height } = props.anchor;
  const bubbleWidth = Math.max(
    0,
    Math.min(props.expanded ? 620 : 360, width - 16),
  );
  const left = Math.max(
    8,
    Math.min(x - bubbleWidth / 2, width - bubbleWidth - 8),
  );
  const below = y < height / 2;
  const gap = 12;
  const space = Math.max(80, (below ? height - y : y) - gap - 8);
  return {
    left: left + "px",
    width: bubbleWidth + "px",
    maxHeight: Math.min(space, height * 0.72) + "px",
    top: below ? y + gap + "px" : "auto",
    bottom: below ? "auto" : height - y + gap + "px",
    "--tail-x": Math.max(14, Math.min(x - left, bubbleWidth - 14)) + "px",
  };
});
</script>

<template>
  <section
    class="dialogue-bubble"
    :class="{ 'tail-above': anchor.y < anchor.height / 2 }"
    :style="placement"
    role="dialog"
    :aria-label="label"
  >
    <div class="dialogue-scroll"><slot /></div>
  </section>
</template>

<style scoped>
.dialogue-bubble {
  position: absolute;
  z-index: 10;
  box-sizing: border-box;
  display: flex;
  border: 1px solid #719f9d;
  border-radius: 10px;
  background: #142532;
  color: #d5e5ed;
  box-shadow: 0 6px 20px #0006;
  pointer-events: auto;
}
.dialogue-bubble::after {
  content: "";
  position: absolute;
  left: var(--tail-x);
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: #142532;
  border-bottom: 1px solid #719f9d;
  border-right: 1px solid #719f9d;
  transform: translateX(-50%) rotate(45deg);
}
.tail-above::after {
  top: -6px;
  bottom: auto;
  transform: translateX(-50%) rotate(225deg);
}
.dialogue-scroll {
  min-width: 0;
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  border-radius: inherit;
  padding: 12px;
}
</style>
