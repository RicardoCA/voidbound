<script setup lang="ts">
import { computed, ref } from "vue";
import CockpitFrame from "./CockpitFrame.vue";
import { useGame } from "../stores/game";
import { planetPosition } from "../universe/generator";

const g = useGame();
const selected = ref("");
const options = computed(() => {
  const ship = g.state.ship;
  const distance = (point: { x: number; y: number }) =>
    Math.round(Math.hypot(point.x - ship.x, point.y - ship.y));
  const planets = g.system.planets.map((planet, index) => ({
    id: planet.id,
    label: planet.name,
    distance: distance(planetPosition(index)),
  }));
  const asteroids = (g.hasAsteroidRadar ? g.asteroids : [])
    .map((rock) => ({
      id: rock.id,
      label: rock.name,
      distance: distance(rock),
    }))
    .sort((a, b) => a.distance - b.distance);
  return { planets, asteroids };
});
</script>

<template>
  <CockpitFrame class="flight-route-frame" />
  <section
    class="dialog flight-route-console"
    aria-label="Computador de navegação"
  >
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">COMPUTADOR DE BORDO · {{ g.system.name }}</div>
        <h2>Traçar rota</h2>
      </div>
      <button class="close" aria-label="Fechar navegação" @click="g.panel = ''">
        ×
      </button>
    </div>
    <p>
      Escolha um destino deste sistema para aproximar a nave no piloto
      automático.
    </p>
    <form
      class="station-form route-target"
      @submit.prevent="g.setRoute(selected)"
    >
      <label for="route-destination">Destino</label>
      <select id="route-destination" v-model="selected" required>
        <option value="" disabled>Selecione um destino</option>
        <optgroup label="Planetas">
          <option
            v-for="planet in options.planets"
            :key="planet.id"
            :value="planet.id"
          >
            {{ planet.label }} ·
            {{ planet.distance.toLocaleString("pt-BR") }} km
          </option>
        </optgroup>
        <optgroup v-if="options.asteroids.length" label="Asteroides">
          <option
            v-for="asteroid in options.asteroids"
            :key="asteroid.id"
            :value="asteroid.id"
          >
            {{ asteroid.label }} ·
            {{ asteroid.distance.toLocaleString("pt-BR") }} km
          </option>
        </optgroup>
      </select>
      <p v-if="g.hasAsteroidRadar && !options.asteroids.length">
        Todos os asteroides deste sistema foram minerados. Novos alvos
        aparecerão após o tempo de reposição.
      </p>
      <button class="primary" :disabled="!selected">
        Ativar piloto automático
      </button>
    </form>
    <button
      v-if="g.routeDestination"
      class="secondary"
      @click="
        g.clearRoute('Rota cancelada.');
        g.panel = '';
      "
    >
      Cancelar rota atual
    </button>
  </section>
</template>

<style scoped>
.flight-route-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.dialog.flight-route-console {
  position: relative;
  width: min(620px, 100%);
  max-height: 67%;
  padding: 14px 18px;
  border: 2px solid #496877;
  background: linear-gradient(140deg, #112b37, #0a1a27);
  box-shadow:
    0 0 0 5px #142232,
    0 10px 0 5px #091320;
}
.flight-route-console h2 {
  margin: 5px 0;
}
.route-target {
  display: grid;
  gap: 8px;
  margin: 10px 0;
}
.route-target select {
  width: 100%;
  min-width: 0;
}
@media (pointer: coarse), (max-width: 760px) {
  .dialog.flight-route-console {
    max-height: min(82%, 460px);
    width: 100%;
  }
  .route-target select {
    font-size: 16px;
    min-height: 44px;
  }
}
</style>
