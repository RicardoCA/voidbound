<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useGame } from "../stores/game";
import { weatherLabels } from "../game/procedural/weather";
import { habitatMessage, planetClock } from "../construction/habitat";
import { useConstruction } from "../stores/construction";
import { releaseControls } from "../game/input";
const g = useGame(),
  b = useConstruction();
const surface = computed(() => g.state.mode === "surface");
const cabin = computed(() => g.state.mode === "interior" || g.flightCabin);
const piloting = computed(() => g.state.mode === "space" && !g.flightCabin);
const station = computed(() => g.state.mode === "docked");
const localTime = computed(() => planetClock(g.state.time));
const location = computed(() =>
  station.value
    ? g.system.station?.name
    : surface.value || g.state.mode === "interior"
      ? g.planet.name
      : g.system.name,
);
const meters = computed(() => [
  {
    label: surface.value ? "VIDA" : "CASCO",
    value: surface.value ? g.state.player.health : g.hullPercent,
    max: 100,
  },
  {
    label: surface.value || cabin.value ? "O₂" : "COMB.",
    value:
      surface.value || cabin.value ? g.state.player.oxygen : g.state.ship.fuel,
    max: surface.value || cabin.value ? 100 : g.maxFuel,
  },
  {
    label: "ENERGIA",
    value: surface.value ? g.state.player.energy : g.state.ship.energy,
    max: 100,
  },
  ...(surface.value && g.hungerEnabled
    ? [{ label: "FOME", value: g.state.player.hunger ?? 100, max: 100 }]
    : []),
]);
const target = computed(() => g.flightTarget);
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
  if (g.inSequence) return;
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
          station
            ? "Interior da estação"
            : cabin
              ? g.model.name +
                " · O₂ nave " +
                Math.ceil(g.state.ship.oxygen) +
                "%"
              : surface
                ? `${g.planet.temperature} °C · ${g.planet.gravity.toFixed(2)} g`
                : `${g.model.name} · ${g.speed} km/s`
        }}</small
      >
    </div>
    <div
      class="mobile-meters"
      :class="{ 'surface-meters': surface && g.hungerEnabled }"
    >
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
      <template v-if="piloting">
        <button class="flight-action" @click="g.standInFlight">Levantar</button>
        <button class="flight-action" @click="open('route')">
          Traçar rota
        </button>
        <button
          class="flight-action"
          :disabled="!g.canSwitchWeapon"
          :aria-label="'Trocar arma. Arma ativa: ' + g.activeWeapon.name"
          @click="g.switchWeapon"
        >
          {{ g.activeWeapon.label }}
          <span v-if="g.canSwitchWeapon" aria-hidden="true">↻</span>
        </button>
      </template>
      <button
        v-if="!cabin && !piloting"
        :aria-label="surface ? 'Abrir mochila' : 'Abrir carga'"
        :title="surface ? 'Mochila' : 'Carga'"
        @click="open('inventory')"
      >
        ▦
      </button>
      <button
        v-if="!cabin && !piloting"
        :aria-label="surface ? 'Abrir construção' : 'Abrir fabricação'"
        :title="surface ? 'Construção' : 'Fabricação'"
        @click="surface ? b.openPalette() : open('craft')"
      >
        {{ surface ? "⌂" : "⌘" }}
      </button>
      <button
        v-if="!surface && !cabin && !piloting"
        aria-label="Abrir mapa galáctico"
        title="Mapa"
        @click="open('map')"
      >
        ✧
      </button>
      <button
        v-if="g.showMission && !station && !cabin"
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
    v-if="
      !g.panel &&
      !g.paused &&
      !b.enabled &&
      !g.inSequence &&
      (!(station || cabin) || transient || g.routePlanet)
    "
    class="mobile-context"
    :class="{ notification: transient }"
    aria-live="polite"
  >
    <template v-if="g.sicknessRemaining"
      >Intoxicação · {{ g.sicknessRemaining }} s</template
    >
    <template v-else-if="surface && g.weather?.kind === 'acid'"
      >Chuva ácida · Procure abrigo</template
    >
    <template v-else-if="transient">{{ transient }}</template>
    <template v-else-if="g.routePlanet"
      >Rota ativa · {{ g.routePlanet.name }}</template
    >
    <template v-else-if="g.state.mode === 'space' && g.flightContact?.wreck">
      {{ g.flightContact.bearing }} Destroço · {{ g.flightContact.distance }} km
      <b v-if="g.flightContact.distance <= 95"> · Toque em Saquear</b>
    </template>
    <template
      v-else-if="
        g.state.mode === 'space' &&
        g.system.station &&
        (g.stationDistance <= 115 || !target.action)
      "
    >
      {{ g.stationBearing }} {{ g.system.station.name }} ·
      {{ Math.round(g.stationDistance) }} km
      <b v-if="g.stationDistance <= 115"> · Toque em Acoplar até 35 km/s</b>
      <template v-else-if="g.flightContact">
        <br />{{ g.flightContact.bearing }} {{ g.flightContact.name }} ·
        {{ g.flightContact.distance }} km
      </template>
    </template>
    <template v-else-if="g.state.mode === 'space' && g.flightContact">
      {{ g.flightContact.bearing }} {{ g.flightContact.name }} ·
      {{ g.flightContact.distance }} km · Casco {{ g.flightContact.hull }}
    </template>
    <template v-else-if="g.state.mode === 'space'"
      >⌖ {{ target.name }} · {{ Math.round(target.distance) }} km
      <b v-if="target.action"
        >·
        {{
          target.action === "orbit"
            ? "Órbita disponível"
            : "No alcance do scanner"
        }}</b
      ></template
    >
    <template
      v-else-if="surface && (g.habitat.hasGenerator || g.habitat.sealed)"
      >{{ habitatMessage(g.habitat) }} · Traje
      {{ Math.ceil(g.state.player.oxygen) }}%</template
    >
    <template v-else-if="surface && g.weather">{{
      weatherLabels[g.weather.kind]
    }}</template>
    <template v-else-if="surface"
      >Toque em frutas ou animais · Interagir: nave / fogueira /
      armário</template
    >
    <template v-if="g.state.mode === 'space' && g.wanted.level">
      <br /><b>⚠ Procurado {{ g.wanted.level }}/5</b>
    </template>
  </div>
</template>
