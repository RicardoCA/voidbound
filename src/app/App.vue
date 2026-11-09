<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { weatherLabels } from "../game/procedural/weather";
import CookingPanel from "../components/CookingPanel.vue";
import { daylight, planetClock } from "../construction/habitat";
import LocalRadar from "../components/LocalRadar.vue";
import StationPanel from "../components/StationPanel.vue";
import { cabinEquipment } from "../game/cabin/CabinInterior";
import { stationServices } from "../game/station/services";
import JumpSequence from "../components/JumpSequence.vue";
import GameCanvas from "../components/GameCanvas.vue";
import MobileHud from "../components/MobileHud.vue";
import TouchControls from "../components/TouchControls.vue";
import BuildPanel from "../components/BuildPanel.vue";
import HabitatStatus from "../components/HabitatStatus.vue";
import BuildToolbar from "../components/BuildToolbar.vue";
import StoragePanel from "../components/StoragePanel.vue";
import { useConstruction } from "../stores/construction";
import InventoryPanel from "../components/InventoryPanel.vue";
import CraftingPanel from "../components/CraftingPanel.vue";
import GalaxyMap from "../components/GalaxyMap.vue";
import BaseRegistry from "../components/BaseRegistry.vue";
import OrbitConsole from "../components/OrbitConsole.vue";
import PlanetScanProgress from "../components/PlanetScanProgress.vue";
import FlightRouteConsole from "../components/FlightRouteConsole.vue";
import { useGame } from "../stores/game";
import { releaseControls } from "../game/input";
import { audio } from "../game/systems/audio";
const b = useConstruction();
const g = useGame(),
  seed = ref("VOIDBOUND"),
  sound = ref(audio.enabled),
  volume = ref(Math.round(audio.volume * 100)),
  showOptions = ref(false),
  confirmNew = ref(false);
watch([sound, volume], ([enabled, percent]) => {
  audio.enabled = enabled;
  audio.volume = percent / 100;
});
watch(
  () => g.paused,
  (paused) => {
    if (!paused) showOptions.value = false;
  },
);
const surface = computed(() => g.state.mode === "surface"),
  inShip = computed(() => g.state.mode === "interior" || g.flightCabin);
const piloting = computed(() => g.state.mode === "space" && !g.flightCabin);
const routeConsole = computed(
  () => piloting.value && g.panel === "route" && !g.paused,
);
const cabinAction = computed(() =>
  g.cabinContact === "pilot" && g.flightCabin
    ? { action: "Voltar a pilotar" }
    : g.cabinContact
      ? cabinEquipment[g.cabinContact]
      : undefined,
);
const orbitConsole = computed(
  () => g.state.mode === "orbit" && !g.panel && !g.paused && !g.inSequence,
);
const atStation = computed(() => g.state.mode === "docked");
const stationWalkTipVisible = ref(false);
let stationWalkTipTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => g.started && atStation.value && !g.stationContact,
  (show) => {
    clearTimeout(stationWalkTipTimer);
    stationWalkTipVisible.value = show;
    if (show) {
      stationWalkTipTimer = setTimeout(() => {
        stationWalkTipVisible.value = false;
      }, 3000);
    }
  },
);
const stationNpc = computed(() =>
  atStation.value
    ? stationServices.find((npc) => g.panel === "station:" + npc.id)
    : undefined,
);
const localTime = computed(() => planetClock(g.state.time));
const nav = computed(() => [
  {
    id: "inventory",
    icon: "▦",
    label: surface.value ? "Mochila" : "Carga",
    key: "I",
  },
  ...(surface.value
    ? [{ id: "build", icon: "⌂", label: "Construir", key: "B" }]
    : [
        { id: "craft", icon: "⌘", label: "Fabricação", key: "C" },
        { id: "map", icon: "✧", label: "Mapa galáctico", key: "M" },
      ]),
]);
const saveTooltipVisible = ref(false);
let saveTooltipTimer: ReturnType<typeof setTimeout> | undefined;
async function saveManually() {
  if (!(await g.save(true))) return;
  clearTimeout(saveTooltipTimer);
  saveTooltipVisible.value = true;
  saveTooltipTimer = setTimeout(() => {
    saveTooltipVisible.value = false;
  }, 2000);
}
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  void g.checkSave();
  timer = setInterval(() => void g.save(), 30000);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(saveTooltipTimer);
  clearTimeout(stationWalkTipTimer);
  window.removeEventListener("blur", blur);
  document.removeEventListener("visibilitychange", visibility);
});
function blur() {
  releaseControls();
  if (g.started) g.paused = true;
  void g.save();
}
function visibility() {
  if (document.hidden) blur();
}
function open(id: string) {
  if (g.inSequence) return;
  g.panel = g.panel === id ? "" : id;
  releaseControls();
}
function newGame() {
  if (g.hasSave && !confirmNew.value) {
    confirmNew.value = true;
    return;
  }
  audio.unlock();
  g.newGame(seed.value);
  confirmNew.value = false;
}
function resumeGame() {
  audio.unlock();
  void g.resume();
}
function unpause() {
  audio.unlock();
  g.paused = false;
}
function minutes() {
  return `${Math.floor(g.state.time / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((g.state.time / 60) % 60)
    .toString()
    .padStart(2, "0")}`;
}
</script>
<template>
  <main
    class="app-shell"
    :class="{
      'is-playing': g.started,
      'is-building': b.enabled,
      'at-station': g.started && atStation,
      'in-cabin': g.started && inShip,
    }"
  >
    <header class="topbar">
      <a
        class="brand"
        href="#"
        @click.prevent="g.started ? (g.paused = !g.paused) : undefined"
        ><span class="brand-mark">◈</span> VOIDBOUND<span class="brand-sub"
          >FRONTEIRAS DO INFINITO</span
        ></a
      >
      <div class="top-right">
        <span class="signal"><i /> SISTEMAS ONLINE</span
        ><span class="build">ALPHA 0.3 / V1 EM DESENVOLVIMENTO</span
        ><button
          v-if="g.started"
          class="icon-button"
          aria-label="Pausar"
          @click="g.paused = !g.paused"
        >
          Ⅱ
        </button>
        <a
          v-else
          class="instagram-link"
          href="https://www.instagram.com/voidbound.br/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram do Voidbound (@voidbound.br, abre em nova aba)"
          title="@voidbound.br"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle
              cx="17.5"
              cy="6.5"
              r="1"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </a>
      </div>
    </header>
    <section class="flight-deck">
      <GameCanvas :playing="g.started" />
      <MobileHud v-if="g.started && !orbitConsole && !routeConsole" />
      <BuildToolbar v-if="g.started" />
      <div
        class="vignette"
        :style="
          surface ? { opacity: 1 - daylight(g.state.time) * 0.75 } : undefined
        "
      />
      <template v-if="!g.started">
        <div class="start-menu">
          <div class="eyebrow">
            <span class="little-line" /> UM UNIVERSO. INFINITAS FRONTEIRAS.
          </div>
          <h1>O desconhecido<br />é só o <em>começo.</em></h1>
          <p>
            Além do último sinal, existe um universo esperando.<br />Explore.
            Construa. Encontre seu caminho entre as estrelas.
          </p>
          <div class="menu-actions">
            <button class="primary large" @click="newGame">
              {{ confirmNew ? "CONFIRMAR NOVA PARTIDA" : "INICIAR EXPEDIÇÃO" }}
              <span>↗</span></button
            ><button
              v-if="g.hasSave"
              class="secondary large"
              @click="resumeGame"
            >
              CONTINUAR EXPEDIÇÃO <span>→</span></button
            ><button
              v-if="confirmNew"
              class="text-button"
              @click="confirmNew = false"
            >
              Cancelar substituição do salvamento
            </button>
          </div>
          <label class="seed-input"
            >SEED DO UNIVERSO
            <input
              v-model="seed"
              @keydown.stop
              @keyup.stop
              maxlength="48"
              aria-label="Seed do universo"
          /></label>
          <div class="menu-bottom">
            <span>01 / EXPLORAÇÃO PROCEDURAL</span
            ><span>02 / SOBREVIVÊNCIA</span
            ><span>03 / SEU PRÓPRIO CAMINHO</span>
          </div>
          <p v-if="confirmNew" class="warning">
            A nova partida substituirá o salvamento existente.
          </p>
        </div>
        <div class="planet-label">
          <span>SETOR 00.00</span><b>{{ g.system.planets[0]?.name }}</b
          ><small>Um sinal à espera de resposta.</small>
        </div>
      </template>
      <template v-else-if="!orbitConsole && !routeConsole">
        <div class="location">
          <div class="eyebrow">
            <span class="little-line" />
            {{
              surface
                ? "EXPLORAÇÃO PLANETÁRIA"
                : inShip
                  ? "CABINE PRESSURIZADA"
                  : atStation
                    ? "INTERIOR DA ESTAÇÃO"
                    : "ESPAÇO PROFUNDO"
            }}
          </div>
          <h2>
            {{
              atStation
                ? g.system.station?.name
                : inShip
                  ? g.model.name
                  : surface
                    ? g.planet.name
                    : g.system.name
            }}
            <span>↗</span>
          </h2>
          <p>
            {{
              surface || inShip
                ? `${g.biome.name} · ${g.planet.temperature} °C · ${g.planet.gravity.toFixed(2)} g`
                : `${g.system.star} · Setor ${g.state.systemX}, ${g.state.systemY}`
            }}
          </p>
          <p v-if="g.routePlanet">Rota ativa · {{ g.routePlanet.name }}</p>
          <p v-if="inShip">
            O₂ nave {{ Math.ceil(g.state.ship.oxygen) }}% · Traje
            {{ Math.ceil(g.state.player.oxygen) }}%
          </p>
          <p class="station-credits">
            {{ g.state.credits.toLocaleString("pt-BR") }} CR
            <span
              v-if="g.wanted.level && g.state.mode === 'space'"
              class="warning"
            >
              · Procurado {{ g.wanted.level }}/5</span
            >
          </p>
          <p v-if="surface || inShip">
            Hora local · <time :datetime="localTime">{{ localTime }}</time>
            <span
              v-if="surface && g.weather"
              :class="{ warning: g.weather.kind === 'acid' }"
            >
              · {{ weatherLabels[g.weather.kind]
              }}{{ g.weather.kind === "acid" ? " · Procure abrigo" : "" }}
            </span>
          </p>
          <p
            v-if="g.state.mode === 'space' && g.system.station"
            class="station-target"
          >
            {{ g.stationBearing }} {{ g.system.station.name }} ·
            {{ Math.round(g.stationDistance) }} km
            <span v-if="g.stationDistance <= 115">
              · [E] ACOPLAR ATÉ 35 km/s</span
            >
          </p>
        </div>
        <HabitatStatus v-if="surface" class="desktop-habitat" />
        <aside
          v-if="g.showMission && !atStation && !inShip"
          class="mission-card"
        >
          <div class="eyebrow">
            <span class="gold-dot" /> DIÁRIO DE EXPEDIÇÃO
            <span class="muted"
              >0{{ Math.min(6, g.state.mission + 1) }} / 06</span
            >
          </div>
          <h3>{{ g.mission.title }}</h3>
          <p>{{ g.mission.text }}</p>
          <div class="mission-track">
            <i
              v-for="n in 6"
              :key="n"
              :class="{
                done: n <= g.state.mission,
                active: n === g.state.mission + 1,
              }"
            />
          </div>
        </aside>
        <div v-if="piloting" class="target-label">
          <span class="target-bracket">⌖</span>
          <div>
            <span>{{
              g.flightTarget.action === "anomaly"
                ? "SINAL DETECTADO"
                : "PLANETA MAIS PRÓXIMO"
            }}</span
            ><b>{{ g.flightTarget.name }}</b
            ><small
              >{{ Math.round(g.flightTarget.distance) }} km
              <span
                v-if="
                  g.flightTarget.action &&
                  g.stationDistance > 115 &&
                  !(g.flightContact?.wreck && g.flightContact.distance <= 95)
                "
                >· [E]
                {{
                  g.flightTarget.action === "orbit"
                    ? "ENTRAR EM ÓRBITA"
                    : "ESCANEAR"
                }}</span
              ></small
            >
          </div>
        </div>
        <div
          v-if="g.stellarWarning && !g.panel && !g.paused"
          class="surface-sequence-caption"
        >
          {{ g.stellarWarning.data.name }} ·
          {{
            g.stellarWarning.protectedByDeflector
              ? "Defletor térmico ativo"
              : "Calor estelar · dano no casco"
          }}
        </div>
        <div v-if="piloting && g.flightContact" class="surface-tip">
          {{ g.flightContact.bearing }}
          {{ g.flightContact.wreck ? "Destroço" : g.flightContact.name }} ·
          {{ g.flightContact.distance }} km
          <template v-if="g.flightContact.wreck">
            · <kbd>E</kbd> Saquear até 95 km</template
          >
          <template v-else>
            · Casco {{ g.flightContact.hull }} · Escudo
            {{ g.flightContact.shield }} · <kbd>F</kbd> Atirar</template
          >
        </div>
        <div v-if="surface && !b.enabled" class="surface-tip">
          MULTITOOL <span>◆</span> Clique para minerar, caçar ou colher frutas
          <kbd>E</kbd> Nave / fogueira / armário <kbd>B</kbd> Construir
        </div>
        <TouchControls
          v-if="
            !g.panel &&
            !g.paused &&
            !g.busy &&
            !g.inSequence &&
            (g.state.mode === 'space' || surface || atStation || inShip)
          "
        />
        <p
          v-if="
            atStation &&
            !g.panel &&
            !g.paused &&
            (g.stationContact || stationWalkTipVisible)
          "
          class="station-walk-tip"
        >
          <template v-if="g.stationContact">
            <kbd>E</kbd> Conversar · {{ g.stationContact }}
          </template>
          <template v-else
            >Aproxime-se de um atendente para conversar.</template
          >
        </p>
        <button
          v-if="inShip && cabinAction && !g.inSequence && !g.panel && !g.paused"
          class="secondary cabin-interaction"
          @click="g.interactCabin"
        >
          <kbd aria-hidden="true">E</kbd> {{ cabinAction.action }}
        </button>
        <p
          v-else-if="inShip && !g.inSequence && !g.panel && !g.paused"
          class="station-walk-tip"
        >
          Aproxime-se de um equipamento para usar.
        </p>
        <div class="bottom-hud" v-if="!atStation && !inShip">
          <section class="ship-status">
            <div class="ship-icon">➤</div>
            <div class="status-data">
              <div class="status-heading">
                {{ surface ? "TRAJE EXPLORADOR" : g.model.name }}
                <span>{{ surface ? "EVA" : g.model.role }}</span>
                <b v-if="g.sicknessRemaining" class="warning"
                  >Intoxicação · {{ g.sicknessRemaining }} s</b
                >
              </div>
              <div class="meters">
                <div>
                  <span>{{ surface ? "VIDA" : "CASCO" }}</span>
                  <div class="meter">
                    <i
                      :style="{
                        width: `${surface ? g.state.player.health : g.hullPercent}%`,
                      }"
                    />
                  </div>
                  <b
                    >{{
                      Math.ceil(
                        surface ? g.state.player.health : g.hullPercent,
                      )
                    }}<small>%</small></b
                  >
                </div>
                <div class="gold">
                  <span>{{ surface ? "OXIGÊNIO" : "COMBUSTÍVEL" }}</span>
                  <div class="meter">
                    <i
                      :style="{
                        width: `${surface ? g.state.player.oxygen : (g.state.ship.fuel / g.maxFuel) * 100}%`,
                      }"
                    />
                  </div>
                  <b
                    >{{
                      Math.ceil(
                        surface ? g.state.player.oxygen : g.state.ship.fuel,
                      )
                    }}<small>{{ surface ? "%" : " U" }}</small></b
                  >
                </div>
                <div class="blue">
                  <span>ENERGIA</span>
                  <div class="meter">
                    <i
                      :style="{
                        width: `${surface ? g.state.player.energy : g.state.ship.energy}%`,
                      }"
                    />
                  </div>
                  <b
                    >{{
                      Math.ceil(
                        surface ? g.state.player.energy : g.state.ship.energy,
                      )
                    }}<small>%</small></b
                  >
                </div>
                <div v-if="surface && g.hungerEnabled" class="gold">
                  <span>FOME</span>
                  <div class="meter">
                    <i :style="{ width: `${g.state.player.hunger ?? 100}%` }" />
                  </div>
                  <b
                    >{{ Math.ceil(g.state.player.hunger ?? 100)
                    }}<small>%</small></b
                  >
                </div>
              </div>
            </div>
          </section>
          <div class="speed-display">
            <span>{{ surface ? "GRAVIDADE" : "VELOCIDADE" }}</span
            ><b
              >{{ surface ? g.planet.gravity.toFixed(2) : g.speed }}
              <small>{{ surface ? "g" : "km/s" }}</small></b
            >
            <div class="speed-ticks">▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏</div>
          </div>
          <nav v-if="piloting" aria-label="Controles da cabine">
            <button @click="g.standInFlight">Levantar</button>
            <button @click="open('route')">Traçar rota</button>
          </nav>
          <nav v-else>
            <button
              v-for="n in nav"
              :key="n.id"
              :class="{ selected: g.panel === n.id }"
              @click="open(n.id)"
            >
              <span class="nav-icon">{{ n.icon }}</span
              ><span>{{ n.label }}</span
              ><kbd>{{ n.key }}</kbd>
            </button>
          </nav>
          <div class="radar"><LocalRadar /><span>RADAR LOCAL</span></div>
        </div>
      </template>
      <div
        v-if="
          g.started &&
          !g.busy &&
          (g.paused || (!g.inSequence && (g.panel || g.state.mode === 'orbit')))
        "
        class="overlay"
        :class="{
          'orbit-overlay': orbitConsole || routeConsole,
        }"
      >
        <section v-if="g.paused && showOptions" class="dialog narrow">
          <h2>Opções</h2>
          <div class="audio-options">
            <label><input v-model="sound" type="checkbox" /> Som do jogo</label>
            <label for="game-volume">Volume do jogo · {{ volume }}%</label>
            <input
              id="game-volume"
              v-model.number="volume"
              type="range"
              min="0"
              max="100"
            />
          </div>
          <div class="audio-options">
            <label
              ><input v-model="g.hungerEnabled" type="checkbox" /> Fome</label
            >
            <label
              ><input v-model="g.autosaveEnabled" type="checkbox" /> Salvamento
              automático</label
            >
            <label
              ><input v-model="g.survivorEnabled" type="checkbox" /> Modo
              sobrevivente</label
            >
            <p>
              No modo sobrevivente, morrer na superfície esvazia a mochila. Se o
              casco zerar, você perde a carga e a mochila. A nave inicial e a
              Sparrow de emergência são estabilizadas.
            </p>
            <p v-if="!g.autosaveEnabled">
              Use Salvar partida no menu de pausa para gravar seu progresso.
            </p>
          </div>
          <button class="primary" @click="showOptions = false">
            VOLTAR À PAUSA
          </button>
        </section>
        <section v-else-if="g.paused" class="dialog narrow">
          <div class="eyebrow">TRANSMISSÃO EM ESPERA</div>
          <h2>Uma pausa entre estrelas.</h2>
          <p>A simulação está pausada.</p>
          <button class="primary" @click="unpause">RETOMAR EXPEDIÇÃO →</button
          ><button class="secondary" @click="saveManually">
            SALVAR PARTIDA</button
          ><button class="secondary" @click="showOptions = true">OPÇÕES</button
          ><button
            class="secondary"
            :disabled="g.trading"
            @click="
              g.save();
              g.started = false;
              g.paused = false;
            "
          >
            VOLTAR AO MENU
          </button>
          <div class="help">
            Nave: W acelerar · S frear · A/D rotacionar · Espaço minerar · F
            atirar · E órbita<br />Superfície: A/D andar · Espaço pular · Clique
            minerar · E embarcar · B construir<br />I carga · Esc pausa
          </div>
        </section>
        <StationPanel
          v-else-if="stationNpc"
          :key="stationNpc.id"
          :npc="stationNpc"
        />
        <section
          v-else-if="g.panel === 'mission'"
          class="dialog mission-dialog"
        >
          <div class="dialog-heading">
            <div>
              <div class="eyebrow">
                DIÁRIO DE EXPEDIÇÃO · {{ Math.min(6, g.state.mission + 1) }} / 6
              </div>
              <h2>{{ g.mission.title }}</h2>
            </div>
            <button
              class="close"
              aria-label="Fechar diário"
              @click="open('mission')"
            >
              ×
            </button>
          </div>
          <p>{{ g.mission.text }}</p>
          <button class="primary" @click="open('mission')">
            VOLTAR À EXPLORAÇÃO
          </button>
        </section>
        <section
          v-else-if="g.panel === 'radar'"
          class="dialog radar-dialog"
          aria-label="Radar local"
        >
          <div class="dialog-heading">
            <div>
              <div class="eyebrow">{{ g.system.name }}</div>
              <h2>Radar local</h2>
            </div>
            <button
              class="close"
              aria-label="Fechar radar local"
              @click="open('radar')"
            >
              ×
            </button>
          </div>
          <LocalRadar />
          <p>
            ▲ Sua nave · ● Planeta
            <template v-if="g.system.station"
              >· <span class="radar-station-label">▣ Estação</span></template
            >
          </p>
          <p v-if="g.system.station" class="radar-station-label">
            {{ g.stationBearing }} {{ g.system.station.name }} ·
            {{ Math.round(g.stationDistance) }} km
          </p>
        </section>
        <section v-else-if="g.panel === 'sleep'" class="dialog">
          <h2>Dormir na cama</h2>
          <p>Avance 8 horas no relógio do planeta.</p>
          <div class="station-actions">
            <button class="primary" @click="b.sleep()">Dormir 8 horas</button>
            <button class="secondary" @click="g.panel = ''">Cancelar</button>
          </div>
        </section>
        <CookingPanel v-else-if="g.panel === 'cook'" />
        <BuildPanel v-else-if="g.panel === 'build'" />
        <StoragePanel v-else-if="g.panel === 'storage'" />
        <InventoryPanel v-else-if="g.panel === 'inventory'" />
        <CraftingPanel v-else-if="g.panel === 'craft'" />
        <section v-else-if="surface && g.panel === 'bases'" class="dialog">
          <div class="dialog-heading">
            <h2>Suas bases e depósitos</h2>
            <button
              class="close"
              aria-label="Fechar depósitos"
              @click="g.panel = ''"
            >
              ×
            </button>
          </div>
          <BaseRegistry :can-locate="false" />
        </section>
        <GalaxyMap
          v-else-if="g.panel === 'map' || g.panel === 'bases'"
          :initial-tab="g.panel === 'bases' ? 'bases' : 'navigation'"
        />
        <FlightRouteConsole v-else-if="routeConsole" />
        <OrbitConsole v-else-if="g.state.mode === 'orbit'" />
        <section
          v-else-if="inShip && g.panel === 'takeoff'"
          class="dialog narrow"
          aria-label="Cadeira do piloto"
        >
          <div class="eyebrow">CONTROLE DE VOO · {{ g.model.name }}</div>
          <h2>Quer decolar?</h2>
          <p>Consumo de decolagem: 5 unidades de combustível.</p>
          <p v-if="g.hullPercent < 70" class="warning">
            Repare o casco até pelo menos 70% antes de decolar.
          </p>
          <p v-else-if="g.state.ship.fuel < 5" class="warning">
            Combustível insuficiente. Use a refinaria ou a recuperação solar.
          </p>
          <div class="station-actions">
            <button
              class="primary"
              :disabled="g.hullPercent < 70 || g.state.ship.fuel < 5"
              @click="g.beginTakeoff"
            >
              Sim, decolar
            </button>
            <button class="secondary" @click="g.panel = ''">Não</button>
          </div>
        </section>
      </div>
      <div
        v-if="g.planetScan && !g.panel && !g.paused"
        class="surface-sequence-caption"
      >
        <PlanetScanProgress />
      </div>
      <div
        v-if="g.inSequence && !g.paused"
        class="surface-sequence-caption"
        role="status"
      >
        {{
          g.dockingSequence
            ? "Acoplando à " + g.system.station?.name
            : g.surfaceSequence?.kind === "landing"
              ? "Descida para " + g.planet.name
              : g.surfaceSequence?.kind === "takeoff"
                ? "Decolando para o espaço"
                : "Desembarcando"
        }}
      </div>
      <JumpSequence v-if="g.busy" />
    </section>
    <Transition name="save-tooltip">
      <div
        v-if="g.started && saveTooltipVisible"
        class="save-tooltip"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">✓</span> Jogo salvo
      </div>
    </Transition>
    <footer class="footer">
      <div class="transmission">
        <span class="status-dot" />
        <span>{{
          g.started ? g.notice : "EXPLORADOR, SUA JORNADA COMEÇA AQUI."
        }}</span>
      </div>
      <div class="footer-right">
        <span v-if="g.started">TEMPO DE VOO {{ minutes() }}</span
        ><button v-if="g.started" @click="g.save(true)">
          ◈ {{ g.saveStatus }}</button
        ><span v-else>UNIVERSO DETERMINÍSTICO · SALVAMENTO LOCAL</span>
      </div>
    </footer>
    <div v-if="g.started" class="keyboard-help">
      <span v-if="surface"
        ><kbd>A</kbd><kbd>D</kbd> MOVIMENTAR <kbd>ESPAÇO</kbd> PULAR <kbd>W</kbd
        ><kbd>S</kbd> ESCALAR <kbd>CLIQUE</kbd> MINERAR
        <kbd>B</kbd> CONSTRUIR</span
      ><span v-else-if="atStation || inShip"
        ><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou setas para
        caminhar</span
      ><span v-else
        ><kbd>W</kbd> PROPULSÃO <kbd>A</kbd><kbd>D</kbd> ROTACIONAR
        <kbd>S</kbd> FREAR <kbd>ESPAÇO</kbd> MINERAR <kbd>F</kbd> ATIRAR</span
      >
      ><span><kbd>E</kbd> INTERAGIR <kbd>ESC</kbd> PAUSAR</span
      ><span class="version">DESBRAVE O QUE VEM DEPOIS.</span>
    </div>
  </main>
</template>
