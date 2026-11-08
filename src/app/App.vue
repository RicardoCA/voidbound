<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { weatherLabels } from "../game/procedural/weather";
import CookingPanel from "../components/CookingPanel.vue";
import { daylight, planetClock } from "../construction/habitat";
import LocalRadar from "../components/LocalRadar.vue";
import StationPanel from "../components/StationPanel.vue";
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
import PlanetBaseSummary from "../components/PlanetBaseSummary.vue";
import { useBases } from "../stores/bases";
import { landingZones } from "../universe/landings";
import { useGame } from "../stores/game";
import { planetPosition } from "../universe/generator";
import { releaseControls } from "../game/input";
import { audio } from "../game/systems/audio";
const b = useConstruction(),
  bases = useBases();
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
  inShip = computed(() => g.state.mode === "interior");
const localTime = computed(() => planetClock(g.state.time));
const closest = computed(() => {
  let d = Infinity,
    index = 0;
  g.system.planets.forEach((_, i) => {
    const p = planetPosition(i),
      dist = Math.hypot(g.state.ship.x - p.x, g.state.ship.y - p.y);
    if (dist < d) {
      d = dist;
      index = i;
    }
  });
  return { planet: g.system.planets[index]!, distance: d, index };
});
const nav = computed(() => [
  { id: "inventory", icon: "▦", label: "Carga", key: "I" },
  { id: "craft", icon: "⌘", label: "Fabricação", key: "C" },
  { id: "map", icon: "✧", label: "Mapa galáctico", key: "M" },
  ...(surface.value
    ? [{ id: "build", icon: "⌂", label: "Construir", key: "B" }]
    : []),
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
function orbitCancel() {
  g.state.mode = "space";
  void g.save();
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
    :class="{ 'is-playing': g.started, 'is-building': b.enabled }"
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
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
    </header>
    <section class="flight-deck">
      <GameCanvas :playing="g.started" />
      <MobileHud v-if="g.started" />
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
      <template v-else>
        <div class="location">
          <div class="eyebrow">
            <span class="little-line" />
            {{
              surface
                ? "EXPLORAÇÃO PLANETÁRIA"
                : inShip
                  ? "SISTEMAS INTERNOS"
                  : "ESPAÇO PROFUNDO"
            }}
          </div>
          <h2>
            {{ surface || inShip ? g.planet.name : g.system.name }}
            <span>↗</span>
          </h2>
          <p>
            {{
              surface || inShip
                ? `${g.biome.name} · ${g.planet.temperature} °C · ${g.planet.gravity.toFixed(2)} g`
                : `${g.system.star} · Setor ${g.state.systemX}, ${g.state.systemY}`
            }}
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
        <aside v-if="g.showMission" class="mission-card">
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
        <div v-if="g.state.mode === 'space'" class="target-label">
          <span class="target-bracket">⌖</span>
          <div>
            <span>PLANETA MAIS PRÓXIMO</span><b>{{ closest.planet.name }}</b
            ><small
              >{{ Math.round(closest.distance) }} km
              <span v-if="closest.distance < 210"
                >· [E] ENTRAR EM ÓRBITA</span
              ></small
            >
          </div>
        </div>
        <div
          v-if="g.state.mode === 'space' && g.flightContact"
          class="surface-tip"
        >
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
            (g.state.mode === 'space' || surface)
          "
        />
        <div class="bottom-hud">
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
          <nav>
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
          (g.paused ||
            (!g.inSequence &&
              (g.panel ||
                g.state.mode === 'orbit' ||
                g.state.mode === 'docked' ||
                inShip)))
        "
        class="overlay"
        :class="{ 'ship-overlay': inShip && !g.panel && !g.paused }"
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
            minerar · E embarcar<br />I carga · C fabricação · M mapa · Esc
            pausa
          </div>
        </section>
        <StationPanel v-else-if="g.state.mode === 'docked' && !g.panel" />
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
        <CookingPanel v-else-if="g.panel === 'cook'" />
        <BuildPanel v-else-if="g.panel === 'build'" />
        <StoragePanel v-else-if="g.panel === 'storage'" />
        <InventoryPanel v-else-if="g.panel === 'inventory'" />
        <CraftingPanel v-else-if="g.panel === 'craft'" />
        <GalaxyMap
          v-else-if="g.panel === 'map' || g.panel === 'bases'"
          :initial-tab="g.panel === 'bases' ? 'bases' : 'navigation'"
        />
        <section
          v-else-if="g.state.mode === 'orbit'"
          class="dialog orbit-dialog"
        >
          <div class="eyebrow">ÓRBITA ESTÁVEL / ESCANEAMENTO CONCLUÍDO</div>
          <h2>{{ g.planet.name }}</h2>
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
              ><b>{{
                g.planet.breathable ? "Respirável" : "Não respirável"
              }}</b>
            </div>
            <div>
              <span>TEMPERATURA</span><b>{{ g.planet.temperature }} °C</b>
            </div>
          </div>
          <p>
            RECURSOS <b>{{ g.biome.resources }}</b>
          </p>
          <p class="warning">△ {{ g.biome.hazard }}</p>
          <PlanetBaseSummary :planet-id="g.planet.id" />
          <h3>Selecione a zona de pouso</h3>
          <div class="landing-zones">
            <button
              v-for="zone in landingZones"
              :key="zone.id"
              class="zone"
              @click="g.beginLanding(zone.id)"
            >
              <span>0{{ zone.id + 1 }} / ZONA SEGURA</span><b>{{ zone.name }}</b
              ><small
                v-if="
                  bases.currentPlanet?.cabinets.some(
                    (c) => c.landing.id === zone.id,
                  )
                "
                class="zone-storage"
                >▤
                {{
                  bases.currentPlanet.cabinets
                    .filter((c) => c.landing.id === zone.id)
                    .reduce((n, c) => n + c.units, 0)
                }}
                unidades · zona mais próxima dos armários</small
              ><small>INICIAR DESCIDA ↓</small>
            </button>
          </div>
          <button class="text-button" @click="orbitCancel">
            ← Retornar ao voo livre
          </button>
        </section>
        <section v-else-if="inShip" class="dialog cockpit">
          <div class="eyebrow">
            <span class="gold-dot" /> {{ g.model.name }} / CABINE PRESSURIZADA
          </div>
          <h2>Lar, entre as estrelas.</h2>
          <p>
            {{
              g.hullPercent < 70
                ? "Casco danificado. Explore a superfície e fabrique um kit de reparo."
                : "Sistemas prontos. A próxima fronteira está à sua espera."
            }}
          </p>
          <div class="cabin-visual">
            <div class="cabin-window">✧ <span>✦</span> · <b>◒</b></div>
            <div class="console-screen">▰ ▰ ▰<br />▱ ▰ ▱</div>
            <div class="console-light" />
          </div>
          <div class="cabin-actions">
            <button class="primary" @click="g.beginDisembark">
              EXPLORAR SUPERFÍCIE ↗</button
            ><button class="secondary" @click="open('craft')">
              ⌘ FABRICAÇÃO & REFINARIA</button
            ><button class="secondary" @click="open('inventory')">
              ▦ CARGA & MELHORIAS</button
            ><button class="secondary" @click="g.recover">
              ☼ RECUPERAÇÃO SOLAR (+60 s)</button
            ><button class="secondary" @click="open('bases')">
              ⌂ BASES E DEPÓSITOS</button
            ><button
              class="primary launch"
              :disabled="g.hullPercent < 70 || g.state.ship.fuel < 5"
              @click="g.takeoff"
            >
              DECOLAR · 5 COMBUSTÍVEL ↑
            </button>
          </div>
          <small
            >Oxigênio da nave: {{ Math.ceil(g.state.ship.oxygen) }}% · Traje:
            {{ Math.ceil(g.state.player.oxygen) }}% · Reabastecimento automático
            enquanto estiver a bordo.</small
          >
        </section>
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
        ><kbd>A</kbd><kbd>D</kbd> MOVIMENTAR <kbd>ESPAÇO</kbd> PULAR
        <kbd>CLIQUE</kbd> MINERAR <kbd>B</kbd> CONSTRUIR</span
      ><span v-else
        ><kbd>W</kbd> PROPULSÃO <kbd>A</kbd><kbd>D</kbd> ROTACIONAR
        <kbd>S</kbd> FREAR <kbd>ESPAÇO</kbd> MINERAR <kbd>F</kbd> ATIRAR</span
      >
      ><span><kbd>E</kbd> INTERAGIR <kbd>ESC</kbd> PAUSAR</span
      ><span class="version">DESBRAVE O QUE VEM DEPOIS.</span>
    </div>
  </main>
</template>
