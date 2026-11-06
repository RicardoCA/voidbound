<script setup lang="ts">
import { computed, ref } from "vue";
import { nearby } from "../universe/generator";
import { useGame } from "../stores/game";
const g = useGame();
function open(id: string) {
  g.panel = g.panel === id ? "" : id;
}
const mapX = ref(0),
  mapY = ref(0),
  selected = ref(""),
  mapSystems = computed(() =>
    nearby(
      g.state.seed,
      g.state.systemX + mapX.value,
      g.state.systemY + mapY.value,
    ),
  ),
  destination = computed(() =>
    mapSystems.value.find((s) => s.id === selected.value),
  ),
  distance = computed(() =>
    destination.value
      ? Math.hypot(
          destination.value.x - g.state.systemX,
          destination.value.y - g.state.systemY,
        )
      : 0,
  );
</script>
<template>
  <section class="dialog map-dialog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">
          NAVEGAÇÃO / ALCANCE {{ g.jumpRange }} ANOS-LUZ
        </div>
        <h2>Além do horizonte</h2>
      </div>
      <button class="close" aria-label="Fechar mapa" @click="open('map')">
        ×
      </button>
    </div>
    <div class="map-toolbar">
      <span
        >SETORES {{ g.state.systemX + mapX }},
        {{ g.state.systemY + mapY }}</span
      >
      <div>
        <button aria-label="Mover mapa à esquerda" @click="mapX--">←</button
        ><button aria-label="Mover mapa para cima" @click="mapY--">↑</button
        ><button
          aria-label="Centralizar mapa"
          @click="
            mapX = 0;
            mapY = 0;
          "
        >
          ⌖</button
        ><button aria-label="Mover mapa para baixo" @click="mapY++">↓</button
        ><button aria-label="Mover mapa à direita" @click="mapX++">→</button>
      </div>
    </div>
    <div class="galaxy-map">
      <div
        class="jump-radius"
        :style="{
          width: `${(g.jumpRange / 7) * 100 * 2}%`,
          height: `${(g.jumpRange / 7) * 100 * 2}%`,
          left: `${50 - (mapX / 7) * 100}%`,
          top: `${50 - (mapY / 7) * 100}%`,
        }"
      />
      <button
        v-for="s in mapSystems"
        :key="s.id"
        class="star-node"
        :class="{
          current: s.id === g.system.id,
          chosen: s.id === selected,
          visited: g.state.visited.includes(s.id),
        }"
        :style="{
          left: `${((s.x - g.state.systemX - mapX + 3.5) / 7) * 100}%`,
          top: `${((s.y - g.state.systemY - mapY + 3.5) / 7) * 100}%`,
        }"
        @click="selected = s.id"
      >
        <span>✦</span><small>{{ s.name }}</small>
      </button>
    </div>
    <div class="map-selection">
      <div>
        <h3>{{ destination?.name ?? "Selecione um sistema" }}</h3>
        <p>
          {{
            destination
              ? `${destination.star} · ${destination.planets.length} planetas · ${distance.toFixed(1)} a.l. · ${Math.ceil(distance * 8)} combustível`
              : "Explore os setores. O círculo indica o alcance do motor."
          }}
        </p>
      </div>
      <button
        class="primary"
        :disabled="
          !destination ||
          g.busy ||
          distance === 0 ||
          distance > g.jumpRange ||
          !g.state.upgrades.includes('jump') ||
          g.state.ship.fuel < Math.ceil(distance * 8) ||
          g.state.mode !== 'space'
        "
        @click="destination && g.jump(destination.x, destination.y)"
      >
        INICIAR SALTO ↗
      </button>
    </div>
    <p v-if="!g.state.upgrades.includes('jump')" class="warning">
      Propulsor de salto necessário. Disponível na missão 05.
    </p>
  </section>
</template>
