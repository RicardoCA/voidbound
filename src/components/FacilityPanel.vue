<script setup lang="ts">
import PlanetCommercePanel from "./PlanetCommercePanel.vue";
import { computed, ref } from "vue";
import { useGame, BACKPACK_SLOTS } from "../stores/game";
import { useConstruction } from "../stores/construction";
import { facilityDefinitions } from "../construction/facilityTypes";
import {
  facilityAccepts,
  refineryRecipes,
  sampleItems,
  FACILITY_SLOTS,
  jobSeconds,
  facilityBearing,
  climateForecast,
} from "../construction/facilities";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { weatherLabels } from "../game/procedural/weather";
import InventoryTransfer from "./InventoryTransfer.vue";
import ItemIcon from "./ItemIcon.vue";
const g = useGame(),
  b = useConstruction();
const recipe = ref("plate"),
  sample = ref<(typeof sampleItems)[number]>("iron"),
  quantity = ref(1),
  input = ref(true);
const current = computed(() => b.facility);
const definition = computed(
  () => current.value && facilityDefinitions[current.value.kind],
);
const forecast = computed(() => climateForecast(g.planet, g.state.time));
const job = computed(() => current.value?.machine.queue[0]);
const seconds = computed(() => {
  const c = current.value,
    j = job.value;
  return c && j ? jobSeconds(c.kind, j.recipe) : 1;
});
function queue() {
  b.queueFacility(
    current.value?.kind === "sampleLab"
      ? sample.value
      : current.value?.kind === "planetRefinery"
        ? recipe.value
        : "scan",
    Number(quantity.value),
  );
}
</script>
<template>
  <section class="dialog facility-panel">
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">INSTALAÇÃO PLANETÁRIA · {{ g.planet.name }}</div>
        <h2>{{ definition?.name ?? "Instalação indisponível" }}</h2>
      </div>
      <button
        class="close"
        aria-label="Fechar instalação"
        @click="g.panel = ''"
      >
        ×
      </button>
    </div>
    <template v-if="current && definition">
      <p>{{ definition.description }}</p>
      <p class="facility-power">
        {{
          current.piece.powered
            ? "Energia disponível no último ciclo"
            : "Sem energia ou instalação ociosa"
        }}
        · Consumo em operação: {{ definition.watts }} energia/s. Placas ou
        baterias até 12 blocos.
      </p>
      <p
        v-if="
          ['observatory', 'weatherStation', 'climateCollector'].includes(
            current.kind,
          )
        "
        class="warning"
      >
        Instale ao ar livre, sem teto ou blocos acima.
      </p>
      <p>
        O trabalho continua enquanto você explora, inclusive em outros planetas.
        Menus e pausa interrompem o relógio; não produz com o jogo fechado.
      </p>
      <PlanetCommercePanel
        v-if="['tradingPost', 'communicationsPost'].includes(current.kind)"
      />
      <template v-else>
        <div
          v-if="
            current.kind === 'weatherStation' ||
            current.kind === 'climateCollector'
          "
          class="facility-reading"
        >
          <template
            v-if="current.kind === 'weatherStation' && !current.piece.powered"
            >Ligue a estação à energia e explore por um instante para atualizar
            a previsão.</template
          ><template v-else-if="forecast"
            >{{ weatherLabels[forecast.kind] }} ·
            {{ forecast.active ? "termina" : "começa" }} em
            {{ forecast.seconds }} segundos ativos.</template
          ><template v-else>Este planeta não apresenta precipitação.</template>
          <p v-if="current.kind === 'weatherStation'">
            Com energia, avisa no HUD 20 segundos antes de chuva ácida ou
            nevasca neste planeta.
          </p>
          <progress
            v-else
            aria-label="Coleta climática"
            :value="current.machine.collection ?? 0"
            :max="10"
          />
        </div>
        <template
          v-if="!['climateCollector', 'weatherStation'].includes(current.kind)"
        >
          <div class="facility-controls">
            <label v-if="current.kind === 'planetRefinery'"
              >Receita<select v-model="recipe">
                <option
                  v-for="(spec, id) in refineryRecipes"
                  :key="id"
                  :value="id"
                >
                  {{ spec.name }} · {{ spec.seconds }} s
                </option>
              </select></label
            >
            <label v-if="current.kind === 'sampleLab'"
              >Amostra<select v-model="sample">
                <option v-for="id in sampleItems" :key="id" :value="id">
                  {{ items[id].name }}
                </option>
              </select></label
            >
            <label
              >Operações<input
                v-model="quantity"
                type="number"
                min="1"
                max="100"
                step="1"
            /></label>
            <button class="primary" @click="queue">
              {{
                ["observatory", "geoProbe"].includes(current.kind)
                  ? "Iniciar leitura"
                  : "Adicionar à fila"
              }}
            </button>
          </div>
          <p v-if="current.kind === 'planetRefinery'" class="facility-cost">
            <span
              v-for="[id, n] in inventoryEntries(
                refineryRecipes[recipe]?.cost ?? {},
              )"
              :key="id"
              ><ItemIcon :item="id" /> {{ n }} {{ items[id].name }} </span
            >por operação, retirados da entrada.
          </p>
          <p v-if="current.kind === 'sampleLab'">
            Uma amostra por análise. Minerais/plantas vêm da mochila; fragmentos
            são recolhidos ao catalogar ruínas (libere um slot). Os dados ficam
            no diário para venda na estação normal. Repetições no mesmo planeta
            valem menos.
          </p>
          <p v-if="job">
            {{ current.machine.queue.reduce((n, j) => n + j.remaining, 0) }}
            operações na fila · {{ Math.ceil(seconds - job.progress) }} segundos
            energizados restantes.
          </p>
          <progress
            v-if="job"
            aria-label="Progresso da instalação"
            :value="job.progress"
            :max="seconds"
          />
          <ol class="facility-queue">
            <li v-for="(entry, i) in current.machine.queue" :key="i">
              {{
                entry.recipe === "scan"
                  ? "Varredura"
                  : (refineryRecipes[entry.recipe]?.name ??
                    items[entry.recipe as keyof typeof items]?.name)
              }}
              × {{ entry.remaining }}
            </li>
          </ol>
        </template>
        <p role="status">{{ current.machine.message }}</p>
        <ul v-if="current.machine.clues?.length" class="facility-clues">
          <li v-for="(clue, i) in current.machine.clues" :key="i">
            <strong>{{ clue.name }}</strong
            ><span v-if="current.kind === 'geoProbe'">{{
              facilityBearing(clue, g.state.player)
            }}</span
            ><span v-else
              >Coordenadas {{ Math.round(clue.x ?? 0) }},
              {{ Math.round(clue.y ?? 0) }}
              {{ clue.planetId ? "na superfície indicada" : "no espaço" }}</span
            >
          </li>
        </ul>
        <template
          v-if="
            ['planetRefinery', 'sampleLab', 'climateCollector'].includes(
              current.kind,
            )
          "
        >
          <div
            class="station-actions"
            v-if="current.kind !== 'climateCollector'"
          >
            <button
              class="secondary"
              :aria-pressed="input"
              @click="input = true"
            >
              Entrada</button
            ><button
              class="secondary"
              :aria-pressed="!input"
              @click="input = false"
            >
              Saída
            </button>
          </div>
          <InventoryTransfer
            :key="current.key + input"
            :left="g.state.backpack"
            :right="
              input && current.kind !== 'climateCollector'
                ? current.machine.input
                : current.machine.output
            "
            :left-capacity="BACKPACK_SLOTS"
            :right-capacity="FACILITY_SLOTS"
            left-title="Sua mochila"
            :right-title="
              input && current.kind !== 'climateCollector'
                ? 'Entrada da instalação'
                : 'Produtos prontos'
            "
            :time="g.state.time"
            :allowed="
              (fromLeft, id) =>
                !fromLeft ||
                (!!current && input && facilityAccepts(current.kind, id))
            "
            :move="
              (fromLeft, id, n) =>
                b.moveFacility(
                  input && current?.kind !== 'climateCollector',
                  fromLeft,
                  id,
                  n,
                )
            "
          />
        </template>
      </template>
    </template>
    <p v-else>Aproxime-se da instalação na superfície para interagir.</p>
  </section>
</template>
<style scoped>
.facility-panel {
  width: min(1080px, 100%);
}
.facility-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
}
.facility-controls label {
  display: grid;
  gap: 6px;
  min-width: 0;
  flex: 1;
  font-size: 12px;
}
.facility-controls select,
.facility-controls input {
  background: #0e1a27;
  color: #dce9ef;
  border: 1px solid #45616c;
  min-height: 44px;
  padding: 8px;
  width: 100%;
}
.facility-controls button {
  min-height: 44px;
  padding: 10px;
}
.facility-reading {
  padding: 14px;
  border: 1px solid #3f626a;
  background: #122d35;
  font-size: 14px;
}
.facility-panel progress {
  width: 100%;
  accent-color: #91d5c7;
}
.facility-clues {
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.facility-clues li {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #354e5a;
  font-size: 13px;
}
.facility-cost {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.facility-cost span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.facility-cost .item-art {
  width: 24px;
  height: 24px;
}
.facility-queue {
  font-size: 12px;
  color: #b6ced4;
}
@media (max-width: 600px) {
  .facility-controls {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
