<script setup lang="ts">
import CockpitFrame from "./CockpitFrame.vue";
import { useGame } from "../stores/game";
import { planetPosition } from "../universe/generator";
const g = useGame();
function distance(index: number) {
  const target = planetPosition(index);
  return Math.round(
    Math.hypot(target.x - g.state.ship.x, target.y - g.state.ship.y),
  );
}
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
      Selecione um planeta deste sistema. O piloto automático aproxima a nave do
      destino.
    </p>
    <div class="flight-route-list">
      <button
        v-for="(planet, index) in g.system.planets"
        :key="planet.id"
        class="secondary"
        @click="g.setRoute(index)"
      >
        {{ planet.name }} · {{ distance(index).toLocaleString("pt-BR") }} km
      </button>
    </div>
    <button
      v-if="g.routePlanet"
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
.flight-route-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
  gap: 6px;
  margin: 10px 0;
}
</style>
