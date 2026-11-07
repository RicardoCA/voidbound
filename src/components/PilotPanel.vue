<script setup lang="ts">
import { computed, ref } from "vue";
import { items, type ParkedShip } from "../game/types";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";
import { marketItems, marketStock, type MarketItem } from "../economy/market";
import { inLocalHangar } from "../fleet/hangar";
import {
  dismissPilot,
  hirePilot,
  PILOT_HIRE_PRICE,
  routeDestinations,
  routeQuote,
  startPilotRoute,
  stopPilotRepeat,
} from "../fleet/pilots";

const props = defineProps<{ ship: ParkedShip }>();
const g = useGame();
const local = computed(() => inLocalHangar(g.state, props.ship));
const destinations = computed(() => routeDestinations(g.state, props.ship));
const destinationId = ref(destinations.value[0]?.id ?? "");
const item = ref<MarketItem>("iron");
const quantity = ref(20);
const repeat = ref(false);
const order = computed(() => {
  const target = destinations.value.find(
    (candidate) => candidate.id === destinationId.value,
  );
  if (!target) return;
  return {
    destination: { x: target.x, y: target.y },
    item: item.value,
    quantity: quantity.value,
    repeat: repeat.value,
  };
});
const quote = computed(
  () => order.value && routeQuote(props.ship, order.value),
);
const stock = computed(() =>
  marketStock(g.state, g.system.station!.id, item.value),
);
const tripDestination = computed(() => {
  const trip = props.ship.pilot?.trip;
  return (
    trip &&
    systemAt(g.state.seed, trip.destination.x, trip.destination.y).station?.name
  );
});

async function hire() {
  if (await g.stationTransaction((draft) => hirePilot(draft, props.ship.id)))
    g.notify("Piloto contratado.");
}
async function dismiss() {
  if (await g.stationTransaction((draft) => dismissPilot(draft, props.ship.id)))
    g.notify("Piloto dispensado.");
}
async function launch() {
  const currentOrder = order.value;
  if (
    currentOrder &&
    (await g.stationTransaction((draft) =>
      startPilotRoute(draft, props.ship.id, currentOrder),
    ))
  )
    g.notify("Rota iniciada. A nave volta a este hangar após a entrega.");
}
async function stop() {
  if (
    await g.stationTransaction((draft) => stopPilotRepeat(draft, props.ship.id))
  )
    g.notify("O piloto voltará ao hangar após a entrega atual.");
}
</script>

<template>
  <div v-if="ship.pilot || local" class="pilot-panel">
    <template v-if="ship.pilot">
      <h3>Piloto {{ ship.pilot.name }}</h3>
      <div v-if="ship.pilot.trip">
        <p>
          Em rota para {{ tripDestination }} · {{ ship.pilot.trip.quantity }} ×
          {{ items[ship.pilot.trip.item].name }}
        </p>
        <p>
          Retorno em
          {{
            Math.max(0, Math.ceil(ship.pilot.trip.returnsAt - g.state.time))
          }}
          s de jogo · {{ ship.pilot.trip.payment }} CR ao voltar
        </p>
        <button
          v-if="ship.pilot.trip.repeat"
          class="secondary"
          :disabled="g.trading"
          @click="stop"
        >
          Parar após esta viagem
        </button>
      </div>
      <template v-else>
        <p>{{ ship.pilot.message ?? "Aguardando rota no hangar." }}</p>
        <form
          v-if="local && destinations.length"
          class="station-form"
          @submit.prevent="launch"
        >
          <label
            >Estação de destino
            <select v-model="destinationId">
              <option
                v-for="target in destinations"
                :key="target.id"
                :value="target.id"
              >
                {{ target.station?.name }} · setor {{ target.x }},
                {{ target.y }}
              </option>
            </select>
          </label>
          <label
            >Recurso do contrato
            <select v-model="item">
              <option
                v-for="resource in marketItems"
                :key="resource"
                :value="resource"
              >
                {{ items[resource].name }}
              </option>
            </select>
          </label>
          <label
            >Quantidade · {{ stock }} no estoque local
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
            />
          </label>
          <label class="pilot-repeat"
            ><input v-model="repeat" type="checkbox" /> Repetir enquanto houver
            saldo, carga e estoque</label
          >
          <p v-if="quote">
            Investimento {{ quote.cost }} CR ({{ quote.freight }} CR de frete
            com combustível) · Recebimento {{ quote.payment }} CR · Lucro
            {{ quote.profit }} CR · {{ quote.duration }} s
          </p>
          <p>O tempo da rota avança enquanto você joga fora dos menus.</p>
          <button
            class="primary"
            :disabled="g.trading || !quote || quote.profit <= 0"
            type="submit"
          >
            Iniciar rota comercial
          </button>
        </form>
        <p v-else-if="local">
          Nenhuma outra estação está no alcance desta nave.
        </p>
        <button
          v-if="local"
          class="secondary"
          :disabled="g.trading"
          @click="dismiss"
        >
          Dispensar piloto
        </button>
      </template>
    </template>
    <button v-else class="secondary" :disabled="g.trading" @click="hire">
      Contratar piloto · {{ PILOT_HIRE_PRICE }} CR
    </button>
  </div>
</template>
