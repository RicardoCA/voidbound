<script setup lang="ts">
import PlanetScanProgress from "./PlanetScanProgress.vue";
import { computed } from "vue";
import { useGame } from "../stores/game";
import { planetPosition } from "../universe/generator";
import { Terrain, tileItems } from "../game/procedural/terrain";
import { items } from "../game/types";
import {
  anomalyAt,
  explorationLevel,
  scannerRange,
} from "../progression/exploration";
import { careerLevel } from "../progression/careers";

const g = useGame();
const range = computed(() => scannerRange(g.state));
const planets = computed(() =>
  g.system.planets.flatMap((planet, index) => {
    const mode = g.state.mode;
    if (
      mode === "docked" ||
      (mode !== "space" && index !== g.state.planetIndex)
    )
      return [];
    const pos = planetPosition(index);
    return [
      {
        planet,
        index,
        distance:
          mode === "space"
            ? Math.hypot(pos.x - g.state.ship.x, pos.y - g.state.ship.y)
            : 0,
      },
    ];
  }),
);
const terrain = computed(
  () => new Terrain(g.planet, g.state.changes[g.planet.id] ?? {}),
);
const contact = computed(() => {
  const site =
    g.state.mode === "space"
      ? anomalyAt(g.system)
      : g.state.mode === "surface"
        ? g.surfaceRuin
        : undefined;
  if (!site || explorationLevel(g.state) < site.level) return;
  const actor = site.kind === "ruin" ? g.state.player : g.state.ship;
  const distance = Math.hypot(site.x - actor.x, site.y - actor.y);
  return {
    site,
    distance,
    dx: Math.round(site.x - actor.x),
    dy: Math.round(site.y - actor.y),
  };
});
const mineralRange = computed(
  () =>
    5 +
    Math.floor(
      (careerLevel("miner", g.state.progression.careers.miner.xp).level - 1) /
        3,
    ),
);
const minerals = computed(() => {
  if (g.state.mode !== "surface") return [];
  const px = Math.floor(g.state.player.x / 16),
    py = Math.floor(g.state.player.y / 16);
  const radius = mineralRange.value;
  const found: {
    x: number;
    y: number;
    distance: number;
    item: "titanium" | "crystal";
  }[] = [];
  for (let x = px - radius; x <= px + radius; x++) {
    for (
      let y = Math.max(0, py - radius);
      y <= Math.min(62, py + radius);
      y++
    ) {
      const distance = Math.hypot(px - x, py - y);
      if (distance > radius) continue;
      const item = tileItems[terrain.value.get(x, y)];
      if (item === "titanium" || item === "crystal")
        found.push({ x, y, distance, item });
    }
  }
  return found.sort((a, b) => a.distance - b.distance).slice(0, 6);
});
</script>

<template>
  <section class="station-form" aria-label="Scanner de exploração">
    <p>
      Alcance de catalogação {{ range }} · Nível
      {{ explorationLevel(g.state) }} de Explorador
    </p>
    <article
      v-for="{ planet, index, distance } in planets"
      :key="planet.id"
      class="dealer-card"
    >
      <h3>{{ planet.name }}</h3>
      <template v-if="g.state.progression.discoveries['planet:' + planet.id]">
        <p>
          {{ g.state.progression.discoveries["planet:" + planet.id]?.notes }}
        </p>
        <small>Catalogado</small>
      </template>
      <template v-else>
        <p v-if="distance">
          {{ Math.round(distance) }} km ·
          {{ distance <= range ? "No alcance" : "Fora do alcance" }}
        </p>
        <PlanetScanProgress v-if="g.planetScan?.index === index" />
        <button
          v-else
          class="primary"
          :disabled="distance > range || Boolean(g.planetScan)"
          @click="g.scanPlanet(index)"
        >
          Catalogar planeta
        </button>
      </template>
    </article>
    <article v-if="contact" class="dealer-card">
      <h3>{{ contact.site.name }}</h3>
      <p>
        {{ Math.round(contact.distance) }} de distância ·
        {{ Math.abs(contact.dx) }} à
        {{ contact.dx < 0 ? "esquerda" : "direita" }} ·
        {{ Math.abs(contact.dy) }} {{ contact.dy < 0 ? "acima" : "abaixo" }}
      </p>
      <button
        class="primary"
        :disabled="
          contact.distance > range ||
          Boolean(g.state.progression.discoveries[contact.site.id])
        "
        @click="g.scanSignal"
      >
        {{
          g.state.progression.discoveries[contact.site.id]
            ? "Sinal catalogado"
            : "Registrar sinal"
        }}
      </button>
    </article>
    <article v-if="g.state.mode === 'surface'" class="dealer-card">
      <h3>Scanner mineral · {{ mineralRange }} blocos</h3>
      <p v-if="!minerals.length">
        Nenhum veio de titânio ou cristal no alcance.
      </p>
      <ul v-else>
        <li v-for="mineral in minerals" :key="`${mineral.x},${mineral.y}`">
          {{ items[mineral.item].name }} · bloco {{ mineral.x }}, camada
          {{ mineral.y }}
        </li>
      </ul>
    </article>
    <p role="status">{{ g.notice }}</p>
  </section>
</template>
