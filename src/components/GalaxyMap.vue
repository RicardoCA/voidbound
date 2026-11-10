<script setup lang="ts">
import { computed, ref } from "vue";
import { starClasses, starKinds, starSystemLabel } from "../universe/stars";
import { nearby } from "../universe/generator";
import CriminalRecord from "./CriminalRecord.vue";
import { wantedBySystem } from "../combat/law";
import { hasBlackMarket } from "../combat/traffic";
import ScannerPanel from "./ScannerPanel.vue";
import CareerProgress from "./CareerProgress.vue";
import BaseRegistry from "./BaseRegistry.vue";
import { useBases } from "../stores/bases";
import type { BaseSummary } from "../construction/catalog";
import { useGame } from "../stores/game";
import type { StarSystem } from "../game/types";
const props = withDefaults(
  defineProps<{ initialTab?: "navigation" | "bases" }>(),
  { initialTab: "navigation" },
);
const g = useGame(),
  bases = useBases(),
  tab = ref<"navigation" | "bases" | "careers" | "scanner" | "law">(
    props.initialTab,
  ),
  focusPlanet = ref("");
function locate(base: BaseSummary) {
  mapX.value = base.system.x - g.state.systemX;
  mapY.value = base.system.y - g.state.systemY;
  selected.value = base.system.id;
  focusPlanet.value = base.planet.id;
  tab.value = "navigation";
}
function inspect(planetId: string) {
  focusPlanet.value = planetId;
  tab.value = "bases";
}
const wantedLevels = computed(() => wantedBySystem(g.state));
const mapX = ref(0),
  mapY = ref(0),
  selected = ref(g.system.id),
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
function stationType(system: StarSystem) {
  if (!system.station) return "Sem estação";
  return hasBlackMarket(system) ? "Estação clandestina" : "Estação espacial";
}
</script>
<template>
  <section class="dialog map-dialog">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">
          NAVEGAÇÃO / ALCANCE {{ g.jumpRange }} ANOS-LUZ
        </div>
        <h2>
          {{
            tab === "law"
              ? "Registro criminal"
              : tab === "scanner"
                ? "Scanner planetário"
                : tab === "careers"
                  ? "Carreiras Galácticas"
                  : tab === "bases"
                    ? "Suas bases e depósitos"
                    : "Além do horizonte"
          }}
        </h2>
      </div>
      <button class="close" aria-label="Fechar mapa" @click="g.panel = ''">
        ×
      </button>
    </div>
    <div
      class="tabs map-tabs"
      role="tablist"
      aria-label="Navegação, depósitos, scanner, carreiras e registro criminal"
    >
      <button
        id="map-navigation-tab"
        role="tab"
        :aria-selected="tab === 'navigation'"
        aria-controls="map-navigation"
        :class="{ active: tab === 'navigation' }"
        @click="tab = 'navigation'"
      >
        Navegação
      </button>
      <button
        id="map-bases-tab"
        role="tab"
        :aria-selected="tab === 'bases'"
        aria-controls="map-bases"
        :class="{ active: tab === 'bases' }"
        @click="
          tab = 'bases';
          focusPlanet = '';
        "
      >
        Bases e depósitos ({{ bases.all.length }})
      </button>
      <button
        id="map-careers-tab"
        role="tab"
        :aria-selected="tab === 'careers'"
        aria-controls="map-careers"
        :class="{ active: tab === 'careers' }"
        @click="tab = 'careers'"
      >
        Carreiras
      </button>
      <button
        id="map-scanner-tab"
        role="tab"
        :aria-selected="tab === 'scanner'"
        aria-controls="map-scanner"
        :class="{ active: tab === 'scanner' }"
        @click="tab = 'scanner'"
      >
        Scanner
      </button>
      <button
        id="map-law-tab"
        role="tab"
        :aria-selected="tab === 'law'"
        aria-controls="map-law"
        :class="{ active: tab === 'law' }"
        @click="tab = 'law'"
      >
        Registro criminal
      </button>
    </div>
    <div
      v-if="tab === 'navigation'"
      id="map-navigation"
      role="tabpanel"
      aria-labelledby="map-navigation-tab"
    >
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
            'has-wanted': wantedLevels.has(s.id),
            'has-base': bases.bySystem.has(s.id),
            'has-stock': (bases.bySystem.get(s.id)?.units ?? 0) > 0,
          }"
          :style="{
            left: `${((s.x - g.state.systemX - mapX + 3.5) / 7) * 100}%`,
            top: `${((s.y - g.state.systemY - mapY + 3.5) / 7) * 100}%`,
          }"
          :aria-label="`${s.name}${wantedLevels.has(s.id) ? ` · Procurado ${wantedLevels.get(s.id)}/5` : ''}${bases.bySystem.has(s.id) ? ` · ${bases.bySystem.get(s.id)!.bases.length} planetas com base · ${bases.bySystem.get(s.id)!.units} unidades guardadas` : ''}`"
          :title="`${s.name} · ${s.id === g.system.id ? 'Sistema atual · ' : ''}${stationType(s)} · ${s.stars.map((star) => starClasses[star.kind].name).join(', ')}${wantedLevels.has(s.id) ? ` · Procurado ${wantedLevels.get(s.id)}/5` : ''}`"
          :aria-description="`${stationType(s)} · ${starSystemLabel(s.stars)} · ${s.stars.map((star) => starClasses[star.kind].name).join(', ')}`"
          :aria-current="s.id === g.system.id ? 'location' : undefined"
          @click="selected = s.id"
        >
          <span class="map-star-symbols" aria-hidden="true">
            <span :style="{ color: starClasses[s.stars[0]!.kind].color }">{{
              hasBlackMarket(s) ? "◆" : s.station ? "▣" : "●"
            }}</span>
            <span
              v-for="star in s.stars.slice(1)"
              :key="star.id"
              :style="{ color: starClasses[star.kind].color }"
              >•</span
            >
          </span>
          <small>{{ s.name }}</small>
          <i
            v-if="bases.bySystem.has(s.id)"
            class="map-base-badge"
            aria-hidden="true"
            >{{ bases.bySystem.get(s.id)!.units > 0 ? "▤" : "⌂" }}</i
          >
          <i
            v-if="wantedLevels.has(s.id)"
            class="map-wanted-badge"
            aria-hidden="true"
          >
            ⚠{{ wantedLevels.get(s.id) }}
          </i>
        </button>
      </div>
      <div class="map-base-legend">
        <span>▣ Estação espacial</span><span>◆ Estação clandestina</span
        ><span>● Sem estação</span><span>▤ Itens armazenados</span
        ><span>⌂ Base sem itens</span
        ><span v-if="wantedLevels.size" class="map-wanted-legend"
          >⚠ Nível de procurado no sistema</span
        >
      </div>
      <div class="map-base-legend" aria-label="Tipos de estrela">
        <span v-for="kind in starKinds" :key="kind">
          <b :style="{ color: starClasses[kind].color }">●</b>
          {{ starClasses[kind].name }}
        </span>
      </div>
      <div class="map-selection">
        <div>
          <h3>{{ destination?.name ?? "Selecione um sistema" }}</h3>
          <p v-if="destination">
            {{ destination.id === g.system.id ? "Sistema atual · " : ""
            }}{{ stationType(destination) }}
          </p>
          <p
            v-if="destination"
            :class="{ 'map-wanted-legend': wantedLevels.has(destination.id) }"
          >
            Procurado neste sistema:
            {{ wantedLevels.get(destination.id) ?? 0 }}/5
          </p>
          <p v-if="destination?.station">
            {{ destination.station.name }} ·
            {{
              destination.station.kind === "clandestine"
                ? "Mercado clandestino, armeiro, contratos piratas e hangar"
                : "Mercado, concessionária, hangar e serviços"
            }}
          </p>
          <p>
            {{
              destination
                ? `${starSystemLabel(destination.stars)} · ${destination.stars.map((star) => starClasses[star.kind].name).join(" + ")} · ${destination.planets.length} planetas · ${distance.toFixed(1)} a.l. · ${Math.ceil(distance * 8)} combustível`
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
      <p v-if="destination && distance > g.jumpRange" class="warning">
        Destino fora do alcance. Avance por sistemas intermediários para
        retornar.
      </p>
      <section
        v-if="destination && bases.bySystem.has(destination.id)"
        class="selected-system-bases"
      >
        <h3>Suas bases neste sistema</h3>
        <button
          v-for="base in bases.bySystem.get(destination.id)!.bases"
          :key="base.planet.id"
          :class="{ focused: focusPlanet === base.planet.id }"
          @click="inspect(base.planet.id)"
        >
          <span>{{ base.planet.name }}</span
          ><b
            >{{ base.units }} unidades · {{ base.cabinets.length }} armários
            →</b
          >
        </button>
      </section>
    </div>
    <div
      v-else-if="tab === 'bases'"
      id="map-bases"
      role="tabpanel"
      aria-labelledby="map-bases-tab"
    >
      <BaseRegistry
        :focus-planet="focusPlanet"
        @locate="locate"
        @clear-focus="focusPlanet = ''"
      />
    </div>
    <div
      v-else-if="tab === 'careers'"
      id="map-careers"
      role="tabpanel"
      aria-labelledby="map-careers-tab"
    >
      <CareerProgress />
    </div>
    <div
      v-else-if="tab === 'scanner'"
      id="map-scanner"
      role="tabpanel"
      aria-labelledby="map-scanner-tab"
    >
      <ScannerPanel />
    </div>
    <div v-else id="map-law" role="tabpanel" aria-labelledby="map-law-tab">
      <CriminalRecord />
    </div>
  </section>
</template>
