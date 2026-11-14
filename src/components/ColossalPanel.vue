<script setup lang="ts">
import { computed, ref } from "vue";
import {
  addColossalBay,
  bayCost,
  buildColossal,
  colossalStages,
  COLOSSAL_RANGE,
  loadColossalFuel,
  selectColossalShip,
  transferColossalShip,
} from "../fleet/colossal";
import { shipModels } from "../fleet/models";
import { items, type Inventory, type Save } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { useGame } from "../stores/game";
import { systemExists, systemAt } from "../universe/generator";

const props = defineProps<{ workshop?: boolean }>();
const g = useGame();
const carrier = computed(() => g.localColossal);
const stage = computed(() => colossalStages[g.state.colossal?.stage ?? 0]);
const cargo = computed(() =>
  g.state.parkedShips.filter(
    (ship) =>
      !ship.pilot &&
      ship.location.x === g.state.systemX &&
      ship.location.y === g.state.systemY,
  ),
);
const destinationX = ref(g.state.systemX + 1);
const destinationY = ref(g.state.systemY);
const distance = computed(() =>
  Math.hypot(
    destinationX.value - g.state.systemX,
    destinationY.value - g.state.systemY,
  ),
);
const target = computed(() =>
  Number.isSafeInteger(destinationX.value) &&
  Number.isSafeInteger(destinationY.value) &&
  distance.value > 0 &&
  distance.value <= COLOSSAL_RANGE &&
  systemExists(g.state.seed, destinationX.value, destinationY.value)
    ? systemAt(g.state.seed, destinationX.value, destinationY.value)
    : undefined,
);
const warpCost = computed(() => Math.ceil(distance.value * 3));
const costText = (cost: Inventory) =>
  inventoryEntries(cost)
    .map(
      ([item, count]) =>
        `${g.state.inventory[item] ?? 0}/${count} ${items[item].name}`,
    )
    .join(" · ");

async function operate(
  operation: (state: Save) => string | undefined,
  success: string,
) {
  if (props.workshop) {
    if (!(await g.stationTransaction(operation))) return;
  } else {
    const error = operation(g.state);
    if (error) return g.notify(error);
    void g.save();
  }
  g.notify(success);
}
function build() {
  const station = g.system.station;
  if (station)
    void operate(
      (state) => buildColossal(state, station.x - 350, station.y - 240),
      "Etapa da colossal concluída.",
    );
}
</script>

<template>
  <component
    :is="workshop ? 'div' : 'section'"
    :class="workshop ? 'station-form' : 'dialog'"
    aria-label="Nave colossal"
  >
    <div class="dialog-heading">
      <h2>
        {{
          workshop
            ? "Estaleiro orbital"
            : g.panel === "colossal-bridge"
              ? "Ponte da colossal"
              : "Hangar da colossal"
        }}
      </h2>
      <button
        v-if="!workshop"
        class="close"
        aria-label="Fechar"
        @click="g.panel = ''"
      >
        ×
      </button>
    </div>
    <template v-if="workshop">
      <p v-if="g.state.colossal && !carrier">
        Colossal no setor {{ g.state.colossal.sector.x }},
        {{ g.state.colossal.sector.y }}.
      </p>
      <template v-else-if="stage">
        <p>Etapa {{ (carrier?.stage ?? 0) + 1 }}/3 · {{ stage.name }}</p>
        <p>{{ costText(stage.cost) }}</p>
        <button class="primary" :disabled="g.trading" @click="build">
          Construir etapa
        </button>
      </template>
      <template v-else-if="carrier">
        <p>
          Colossal operacional. Aproxime-se dela no espaço e freie para
          embarcar.
        </p>
        <p>
          {{ carrier.ships.length }}/{{ carrier.slots }} vagas ocupadas. Reserve
          uma vaga para embarcar.
        </p>
        <div v-for="ship in cargo" :key="ship.id" class="station-actions">
          <span>{{ shipModels[ship.model].name }} · {{ ship.id }}</span>
          <button
            class="secondary"
            :disabled="g.trading"
            @click="
              operate(
                (state) => transferColossalShip(state, ship.id),
                'Transferência concluída.',
              )
            "
          >
            {{
              carrier.ships.includes(ship.id)
                ? "Transferir à estação"
                : "Transferir à colossal"
            }}
          </button>
        </div>
      </template>
    </template>
    <template v-else-if="carrier">
      <p>
        Hangar {{ carrier.ships.length + 1 }}/{{ carrier.slots }} · Refinado
        {{ Math.floor(carrier.fuel) }} · Dobra {{ carrier.warp }}
      </p>
      <template v-if="g.panel === 'colossal-bridge'">
        <div class="station-actions">
          <button
            class="secondary"
            @click="
              operate(
                (s) => loadColossalFuel(s, 'fuel'),
                'Tanque de manobra abastecido.',
              )
            "
          >
            Carregar refinado
          </button>
          <button
            class="secondary"
            @click="
              operate(
                (s) => loadColossalFuel(s, 'warpFuel'),
                'Tanque de dobra abastecido.',
              )
            "
          >
            Carregar dobra
          </button>
          <button
            class="secondary"
            @click="
              g.colossalHelm = true;
              g.panel = '';
            "
          >
            Pilotar colossal
          </button>
          <button class="secondary" @click="g.panel = 'colossal-map'">
            Abrir mapa galáctico
          </button>
        </div>
        <p>Alcance de dobra {{ COLOSSAL_RANGE }} a.l.</p>
        <div class="station-actions">
          <label
            >Setor X
            <input v-model.number="destinationX" type="number" step="1"
          /></label>
          <label
            >Setor Y
            <input v-model.number="destinationY" type="number" step="1"
          /></label>
        </div>
        <p v-if="target">
          {{ target.name }} · {{ distance.toFixed(1) }} a.l. · {{ warpCost }} de
          dobra · {{ (4 + distance * 0.2).toFixed(1) }} s
        </p>
        <p v-else>Escolha um sistema existente dentro do alcance.</p>
        <button
          class="primary"
          :disabled="!target || carrier.warp < warpCost"
          @click="g.jumpColossal(destinationX, destinationY)"
        >
          Iniciar salto de dobra
        </button>
      </template>
      <template v-else>
        <p>Nave selecionada · {{ g.model.name }}</p>
        <div
          v-for="ship in cargo.filter((entry) =>
            carrier?.ships.includes(entry.id),
          )"
          :key="ship.id"
          class="station-actions"
        >
          <span>{{ shipModels[ship.model].name }} · {{ ship.id }}</span>
          <button
            class="secondary"
            @click="
              operate(
                (state) => selectColossalShip(state, ship.id),
                'Nave selecionada.',
              )
            "
          >
            Selecionar
          </button>
        </div>
        <p>Nova vaga · {{ costText(bayCost) }}</p>
        <div class="station-actions">
          <button
            class="secondary"
            @click="operate(addColossalBay, 'Nova vaga construída.')"
          >
            Construir vaga
          </button>
          <button class="secondary" @click="g.panel = 'inventory'">
            Carga da nave
          </button>
          <button class="secondary" @click="g.panel = 'craft'">
            Bancada e refinaria
          </button>
          <button class="primary" @click="g.leaveColossal">
            Sair com a nave selecionada
          </button>
        </div>
      </template>
    </template>
    <p v-if="g.notice" role="status">{{ g.notice }}</p>
  </component>
</template>
