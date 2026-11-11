<script setup lang="ts">
import { computed } from "vue";
import CockpitFrame from "./CockpitFrame.vue";
import PlanetBaseSummary from "./PlanetBaseSummary.vue";
import { landingZones } from "../universe/landings";
import { useGame } from "../stores/game";
import { useBases } from "../stores/bases";
const g = useGame();
const bases = useBases();
const storedByZone = computed(() => {
  const units = new Map<number, number>();
  for (const cabinet of bases.currentPlanet?.cabinets ?? []) {
    const id = cabinet.landing.id;
    units.set(id, (units.get(id) ?? 0) + cabinet.units);
  }
  return units;
});
function leaveOrbit() {
  g.state.mode = "space";
  void g.save();
}
</script>

<template>
  <CockpitFrame class="orbit-canopy" />
  <section
    class="dialog orbit-dialog orbit-console"
    aria-label="Computador de bordo"
  >
    <header class="orbit-console-header">
      <div>
        <div class="eyebrow">COMPUTADOR DE BORDO · {{ g.model.name }}</div>
        <small>ÓRBITA ESTÁVEL / ESCANEAMENTO CONCLUÍDO</small>
        <h2>{{ g.planet.name }}</h2>
      </div>
      <div class="orbit-console-actions">
        <button class="secondary" @click="leaveOrbit">
          ← Retornar ao voo livre
        </button>
        <button class="secondary" aria-label="Pausar" @click="g.paused = true">
          Ⅱ
        </button>
      </div>
    </header>
    <div class="orbit-console-grid">
      <div class="orbit-landing">
        <h3>Selecione a zona de pouso</h3>
        <div class="landing-zones">
          <button
            v-for="zone in landingZones"
            :key="zone.id"
            class="zone"
            @click="g.beginLanding(zone.id)"
          >
            <span>0{{ zone.id + 1 }} / ZONA SEGURA</span><b>{{ zone.name }}</b
            ><small v-if="storedByZone.has(zone.id)" class="zone-storage">
              ▤ {{ storedByZone.get(zone.id) }} unidades · zona mais próxima dos
              armários </small
            ><small>INICIAR DESCIDA ↓</small>
          </button>
        </div>
      </div>
      <div class="orbit-telemetry">
        <p class="planet-type">
          {{ g.biome.name }} · Raio
          {{ g.planet.radius.toLocaleString("pt-BR") }} km
        </p>
        <div class="planet-facts">
          <div>
            <span>GRAVIDADE</span><b>{{ g.planet.gravity.toFixed(2) }} g</b>
          </div>
          <div>
            <span>ATMOSFERA</span
            ><b>{{ g.planet.breathable ? "Respirável" : "Não respirável" }}</b>
          </div>
          <div>
            <span>TEMPERATURA</span><b>{{ g.planet.temperature }} °C</b>
          </div>
        </div>
        <p>
          RECURSOS <b>{{ g.biome.resources }}</b>
        </p>
        <p class="warning">△ {{ g.biome.hazard }}</p>
        <p v-if="g.civilization">
          {{ g.civilization.name }} · Conselho a leste da zona de pouso
        </p>
        <PlanetBaseSummary :planet-id="g.planet.id" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.orbit-canopy {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.dialog.orbit-console {
  position: relative;
  width: min(900px, 100%);
  max-height: 59%;
  padding: 14px 18px;
  border: 2px solid #496877;
  background: linear-gradient(140deg, #112b37, #0a1a27);
  box-shadow:
    0 0 0 5px #142232,
    0 12px 0 5px #091320;
}
.orbit-console-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  border-bottom: 1px solid #3a5b68;
  margin-bottom: 10px;
}
.orbit-console-header small {
  font-size: 9px;
  color: var(--mint);
}
.orbit-console h2 {
  margin: 4px 0 10px;
}
.orbit-console-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.orbit-console-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  grid-template-areas: "telemetry landing";
  gap: 16px;
}
.orbit-telemetry {
  grid-area: telemetry;
}
.orbit-landing {
  grid-area: landing;
}
.orbit-console h3,
.orbit-console p {
  margin: 4px 0;
}
.orbit-console .planet-facts {
  padding: 8px 0;
  margin: 8px 0;
}
.orbit-console .planet-facts > div {
  gap: 3px;
}
.orbit-console .landing-zones {
  margin: 8px 0;
}
.orbit-console .zone {
  padding: 9px;
  gap: 8px;
  min-width: 0;
}
@media (max-width: 620px) {
  .dialog.orbit-console {
    max-height: 62%;
    padding: 10px 12px;
  }
  .orbit-console-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "landing" "telemetry";
    gap: 8px;
  }
}
</style>
