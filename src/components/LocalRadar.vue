<script setup lang="ts">
import { starClasses } from "../universe/stars";
import { useGame } from "../stores/game";
import { planetPosition } from "../universe/generator";

const g = useGame();

function position(target: { x: number; y: number }) {
  const dx = target.x - g.state.ship.x;
  const dy = target.y - g.state.ship.y;
  const scale = Math.max(22, Math.hypot(dx, dy) / 36);
  return { x: 45 + dx / scale, y: 45 + dy / scale };
}
</script>

<template>
  <svg
    class="local-radar"
    viewBox="0 0 90 90"
    role="img"
    aria-label="Radar do sistema"
  >
    <circle cx="45" cy="45" r="40" />
    <circle cx="45" cy="45" r="24" />
    <path d="M45 5V85M5 45H85" />
    <circle
      v-for="star in g.system.stars"
      :key="star.id"
      :cx="position(star).x"
      :cy="position(star).y"
      r="3"
      :style="{ fill: starClasses[star.kind].color, stroke: 'none' }"
    >
      <title>{{ starClasses[star.kind].name }}</title>
    </circle>
    <circle
      v-for="(planet, i) in g.system.planets"
      :key="planet.id"
      :cx="position(planetPosition(i)).x"
      :cy="position(planetPosition(i)).y"
      r="2"
      class="radar-planet"
    >
      <title>{{ planet.name }}</title>
    </circle>
    <circle
      v-if="g.system.blackHole"
      :cx="position(g.system.blackHole).x"
      :cy="position(g.system.blackHole).y"
      r="3.5"
      style="fill: #160d2c; stroke: #cf9bff"
    >
      <title>Buraco negro</title>
    </circle>
    <rect
      v-if="g.system.station"
      :x="position(g.system.station).x - 3"
      :y="position(g.system.station).y - 3"
      width="6"
      height="6"
      class="radar-station"
    >
      <title>{{ g.system.station.name }}</title>
    </rect>
    <template v-if="g.state.mode === 'space'">
      <rect
        v-for="npc in g.radarShips"
        :key="npc.id"
        :x="position(npc).x - 2"
        :y="position(npc).y - 2"
        width="4"
        height="4"
        rx="1"
        :style="{
          fill:
            npc.role === 'pirate' || npc.engaged
              ? '#ff8a83'
              : npc.role === 'ally'
                ? '#80e4ae'
                : npc.role === 'miner'
                  ? '#f4c478'
                  : '#8deaf2',
          stroke: 'none',
        }"
      >
        <title>{{ npc.name }}</title>
      </rect>
    </template>
    <path d="M45 40L48 49L45 47L42 49Z" class="radar-ship" />
  </svg>
</template>
