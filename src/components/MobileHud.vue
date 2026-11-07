<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useGame } from "../stores/game";
import { habitatMessage, planetClock } from "../construction/habitat";
import { useConstruction } from "../stores/construction";
import { planetPosition } from "../universe/generator";
import { releaseControls } from "../game/input";
const g = useGame(),
  b = useConstruction();
const surface = computed(() => g.state.mode === "surface");
const localTime = computed(() => planetClock(g.state.time));
const location = computed(() =>
  surface.value || g.state.mode === "interior" ? g.planet.name : g.system.name,
);
const meters = computed(() => [
  {
    label: surface.value ? "VIDA" : "CASCO",
    value: surface.value ? g.state.player.health : g.hullPercent,
    max: 100,
  },
  {
    label: surface.value ? "O₂" : "COMB.",
    value: surface.value ? g.state.player.oxygen : g.state.ship.fuel,
    max: surface.value ? 100 : g.maxFuel,
  },
  {
    label: "ENERGIA",
    value: surface.value ? g.state.player.energy : g.state.ship.energy,
    max: 100,
  },
  ...(surface.value
    ? [{ label: "FOME", value: g.state.player.hunger ?? 100, max: 100 }]
    : []),
]);
const target = computed(() => {
  const ship = g.state.ship;
  let distance = Infinity,
    name = "";
  g.system.planets.forEach((planet, i) => {
    const p = planetPosition(i),
      d = Math.hypot(ship.x - p.x, ship.y - p.y);
    if (d < distance) {
      distance = d;
      name = planet.name;
    }
  });
  return { distance, name };
});
const transient = ref("");
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => g.notice,
  (text) => {
    transient.value = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (transient.value = ""), 4000);
  },
);
onBeforeUnmount(() => clearTimeout(noticeTimer));
function open(panel: string) {
  releaseControls();
  g.panel = g.panel === panel ? "" : panel;
}
function pause() {
  releaseControls();
  g.paused = true;
}
</script>
<template>
  <div class="mobile-hud">
    <div class="mobile-location">
      <span>{{ g.state.credits.toLocaleString("pt-BR") }} CR</span
      ><strong>{{ location }}</strong
      ><small
        ><template v-if="surface || g.state.mode === 'interior'"
          ><time
            :datetime="localTime"
            :aria-label="'Hora local: ' + localTime"
            title="Hora local do planeta"
            >{{ localTime }}</time
          >
          · </template
        >{{
          surface
            ? `${g.planet.temperature} °C · ${g.planet.gravity.toFixed(2)} g`
            : `${g.model.name} · ${g.speed} km/s`
        }}</small
      >
    </div>
    <div class="mobile-meters" :class="{ 'surface-meters': surface }">
      <div
        v-for="(meter, i) in meters"
        :key="meter.label"
        class="mobile-meter"
        :class="[`meter-${i}`, { critical: meter.value < 20 }]"
        :aria-label="`${meter.label}: ${Math.ceil(meter.value)}`"
      >
        <div>
          <span>{{ meter.label }}</span
          ><b>{{ Math.ceil(meter.value) }}</b>
        </div>
        <i
          ><span
            :style="{
              width: `${Math.max(0, Math.min(100, (meter.value / meter.max) * 100))}%`,
            }"
        /></i>
      </div>
      <button
        class="mobile-radar-toggle"
        aria-label="Abrir radar local"
        :aria-expanded="g.panel === 'radar'"
        @click="open('radar')"
      >
        <span aria-hidden="true">⌖</span> Radar
      </button>
    </div>
    <nav class="mobile-tools" aria-label="Painéis do jogo">
      <button aria-label="Abrir carga" title="Carga" @click="open('inventory')">
        ▦
      </button>
      <button
        :aria-label="surface ? 'Abrir construção' : 'Abrir fabricação'"
        :title="surface ? 'Construção' : 'Fabricação'"
        @click="surface ? b.openPalette() : open('craft')"
      >
        {{ surface ? "⌂" : "⌘" }}
      </button>
      <button
        aria-label="Abrir mapa galáctico"
        title="Mapa"
        @click="open('map')"
      >
        ✧
      </button>
      <button
        v-if="g.showMission"
        aria-label="Abrir diário de expedição"
        title="Missão"
        class="mission-toggle"
        @click="open('mission')"
      >
        ☷<small>{{ Math.min(6, g.state.mission + 1) }}/6</small>
      </button>
      <button aria-label="Pausar jogo" title="Pausar" @click="pause">Ⅱ</button>
    </nav>
  </div>
  <div
    v-if="!g.panel && !g.paused && !b.enabled"
    class="mobile-context"
    :class="{ notification: transient }"
    aria-live="polite"
  >
    <template v-if="g.sicknessRemaining"
      >Intoxicação · {{ g.sicknessRemaining }} s</template
    >
    <template v-else-if="transient">{{ transient }}</template>
    <template
      v-else-if="
        g.state.mode === 'space' &&
        g.system.station &&
        (g.stationDistance <= 115 || target.distance >= 210)
      "
    >
      {{ g.stationBearing }} {{ g.system.station.name }} ·
      {{ Math.round(g.stationDistance) }} km
      <b v-if="g.stationDistance <= 115"> · Toque em Acoplar até 35 km/s</b>
    </template>
    <template v-else-if="g.state.mode === 'space'"
      >⌖ {{ target.name }} · {{ Math.round(target.distance) }} km
      <b v-if="target.distance < 210">· Órbita disponível</b></template
    >
    <template
      v-else-if="surface && (g.habitat.hasGenerator || g.habitat.sealed)"
      >{{ habitatMessage(g.habitat) }} · Traje
      {{ Math.ceil(g.state.player.oxygen) }}%</template
    >
    <template v-else-if="surface"
      >Toque em frutas ou animais · Interagir: nave / fogueira /
      armário</template
    >
  </div>
</template>
