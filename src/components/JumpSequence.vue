<script setup lang="ts">
import { random } from "../game/procedural/random";
import { JUMP_DURATION_MS } from "../stores/game";

const r = random(940);
const stars = Array.from({ length: 64 }, (_, i) => {
  const angle = ((i + r()) * Math.PI * 2) / 64;
  const distance = 38 + r() * 205;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const trail = 30 + r() * 95;
  return {
    x: 240 + dx * distance,
    y: 130 + dy * distance,
    tailX: 240 + dx * Math.max(2, distance - trail),
    tailY: 130 + dy * Math.max(2, distance - trail),
    color: i % 5 === 0 ? "#bca7ff" : i % 3 === 0 ? "#f6f8ff" : "#8de4ff",
    width: i % 6 === 0 ? 2 : 1,
  };
});
</script>

<template>
  <div
    class="jump-overlay"
    role="status"
    :style="{ '--jump-duration': JUMP_DURATION_MS + 'ms' }"
  >
    <svg
      class="jump-window"
      viewBox="0 0 480 260"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g class="jump-stars">
        <circle
          v-for="(star, i) in stars"
          :key="i"
          :cx="star.x"
          :cy="star.y"
          :r="star.width * 0.8"
          :fill="star.color"
        />
      </g>
      <g class="jump-trails">
        <line
          v-for="(star, i) in stars"
          :key="i"
          :x1="star.tailX"
          :y1="star.tailY"
          :x2="star.x"
          :y2="star.y"
          :stroke="star.color"
          :stroke-width="star.width"
          :opacity="i % 4 === 0 ? 0.95 : 0.58"
          pathLength="100"
        />
      </g>
    </svg>
    <div class="jump-glow" aria-hidden="true"></div>
    <svg
      class="jump-cockpit"
      viewBox="0 0 480 260"
      preserveAspectRatio="none"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <path
        fill="#0b1423"
        d="M0 0h480v14H0zM0 0h42L21 65 10 167l53 57h354l53-57-11-102L438 0h42v260H0z"
      />
      <path
        fill="#2a4054"
        d="M27 0h14L21 67l-9 102 50 53h356l50-53-9-102L439 0h14l20 65 7 106-55 60H55L0 171l7-106z"
      />
      <path fill="#162538" d="M26 260l50-38h328l50 38z" />
      <path
        fill="#0c1928"
        stroke="#345466"
        d="M177 260l12-28h102l12 28zM72 253l28-19h57l-10 19zM408 253l-28-19h-57l10 19z"
      />
      <path fill="#74ccc6" d="M105 240h34v2h-34zM342 240h33v2h-33z" />
      <path
        fill="#d4b079"
        d="M111 247h7v3h-7zM124 247h7v3h-7zM356 247h7v3h-7zM369 247h7v3h-7z"
      />
      <path fill="#274a58" d="M209 240h62v10h-62z" />
      <path fill="#94e5d8" d="M213 243h54v4h-54z" />
    </svg>
    <div class="jump-caption">
      <strong>Salto interestelar</strong>
      <span>Vista da cabine</span>
    </div>
  </div>
</template>

<style scoped>
.jump-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  background: radial-gradient(
    ellipse at center,
    #22485e,
    #0a1529 38%,
    #060d1a 78%
  );
}
.jump-window,
.jump-cockpit,
.jump-glow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.jump-stars {
  animation: jump-stars var(--jump-duration) ease-in-out both;
}
.jump-trails {
  transform-origin: 50% 50%;
  transform-box: view-box;
  stroke-dasharray: 100;
  animation: jump-trails var(--jump-duration) ease-in-out both;
}
.jump-glow {
  background: radial-gradient(
    ellipse at center,
    #d9fbff 0%,
    #85ddf766 18%,
    transparent 62%
  );
  animation: jump-glow var(--jump-duration) ease-in-out both;
}
.jump-caption {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: 5px;
  max-width: 90%;
  padding: 7px 14px;
  text-align: center;
  background: #091729df;
  border: 1px solid #486874;
  color: #b8f1e7;
  white-space: nowrap;
}
.jump-caption span {
  font-size: 10px;
  color: #a9c6d3;
}
@keyframes jump-stars {
  0%,
  100% {
    opacity: 1;
  }
  25%,
  84% {
    opacity: 0;
  }
}
@keyframes jump-trails {
  0% {
    opacity: 0;
    transform: scale(0.65);
    stroke-dashoffset: 95;
  }
  28% {
    opacity: 1;
    transform: scale(0.85);
    stroke-dashoffset: 0;
  }
  68% {
    opacity: 1;
    transform: scale(1.25);
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
    stroke-dashoffset: -55;
  }
}
@keyframes jump-glow {
  0%,
  100% {
    opacity: 0;
  }
  35% {
    opacity: 0.25;
  }
  76% {
    opacity: 0.6;
  }
}
@media (prefers-reduced-motion: reduce) {
  .jump-stars,
  .jump-trails,
  .jump-glow {
    animation: none;
  }
  .jump-trails,
  .jump-glow {
    opacity: 0;
  }
}
</style>
