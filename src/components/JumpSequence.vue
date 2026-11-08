<script setup lang="ts">
import CockpitFrame from "./CockpitFrame.vue";
import { random } from "../game/procedural/random";
import { JUMP_DURATION_MS } from "../stores/game";

const r = random(940);
const stars = Array.from({ length: 108 }, (_, i) => {
  const angle = ((i + r()) * Math.PI * 2) / 108;
  const distance = 38 + r() * 205;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const trail = 30 + r() * 95;
  return {
    flare: i % 12 === 0,
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
      <defs>
        <radialGradient id="jump-nebula">
          <stop stop-color="#9af7ec" stop-opacity=".22" />
          <stop offset=".55" stop-color="#5d64b0" stop-opacity=".18" />
          <stop offset="1" stop-color="#252148" stop-opacity="0" />
        </radialGradient>
      </defs>
      <g class="jump-nebula">
        <ellipse
          cx="240"
          cy="130"
          rx="236"
          ry="71"
          fill="url(#jump-nebula)"
          transform="rotate(-22 240 130)"
        />
        <ellipse
          cx="248"
          cy="126"
          rx="161"
          ry="45"
          fill="url(#jump-nebula)"
          transform="rotate(29 248 126)"
        />
      </g>
      <g class="jump-stars">
        <circle
          v-for="(star, i) in stars"
          :key="i"
          :cx="star.x"
          :cy="star.y"
          :r="star.width * 0.8"
          :fill="star.color"
        />
        <path
          v-for="(star, i) in stars.filter((star) => star.flare)"
          :key="'flare-' + i"
          :d="`M${star.x - 4} ${star.y}h8M${star.x} ${star.y - 3}v6`"
          :stroke="star.color"
          stroke-width=".45"
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
    <CockpitFrame jump class="jump-cockpit" />
    <div class="jump-console" aria-hidden="true"></div>
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
.jump-nebula {
  transform-origin: center;
  animation: jump-nebula var(--jump-duration) ease-in-out both;
}
.jump-console {
  position: absolute;
  bottom: 5.1%;
  left: 44.4%;
  width: 11.2%;
  height: 1.15%;
  background: repeating-linear-gradient(90deg, #b2fff0 0 17%, #36757c 17% 20%);
  transform-origin: left;
  animation: jump-charge var(--jump-duration) linear both;
}
@keyframes jump-charge {
  from {
    transform: scaleX(0.05);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes jump-nebula {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.65;
  }
  54% {
    transform: scale(1.8);
    opacity: 1;
  }
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
  .jump-nebula,
  .jump-console,
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
