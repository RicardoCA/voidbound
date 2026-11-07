<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { items, type Item } from "../game/types";
import { useGame } from "../stores/game";
import { systemAt } from "../universe/generator";
import { slots } from "../inventory/inventory";
import {
  activateShip,
  inLocalHangar,
  resalePrice,
  sellShip,
  shipCapacity,
  shipFuelCapacity,
  transferShipCargo,
} from "../fleet/hangar";
import { shipModels } from "../fleet/models";
import PilotPanel from "./PilotPanel.vue";
import ShipSprite from "./ShipSprite.vue";

defineProps<{ dealership?: boolean }>();
const g = useGame();
const fromId = ref("");
const toId = ref("");
const resource = ref<Item>();
const quantity = ref(1);
const localShips = computed(() => [
  { ...g.state.activeShip, inventory: g.state.inventory },
  ...g.state.parkedShips.filter(
    (ship) => inLocalHangar(g.state, ship) && !ship.pilot?.trip,
  ),
]);
const resources = computed(() => {
  const ship = localShips.value.find((ship) => ship.id === fromId.value);
  return Object.keys(ship?.inventory ?? {}) as Item[];
});
watchEffect(() => {
  const ships = localShips.value;
  if (!ships.some((ship) => ship.id === fromId.value))
    fromId.value = ships[0]!.id;
  if (
    toId.value === fromId.value ||
    !ships.some((ship) => ship.id === toId.value)
  )
    toId.value = ships.find((ship) => ship.id !== fromId.value)?.id ?? "";
  if (!resource.value || !resources.value.includes(resource.value))
    resource.value = resources.value[0];
});
function location(x: number, y: number) {
  const system = systemAt(g.state.seed, x, y);
  return `${system.station?.name ?? system.name} · setor ${x}, ${y}`;
}
async function activate(id: string) {
  if (await g.stationTransaction((draft) => activateShip(draft, id)))
    g.notify(`${g.model.name} selecionada como nave ativa.`);
}
const saleId = ref("");
async function sell(id: string) {
  if (await g.stationTransaction((draft) => sellShip(draft, id))) {
    saleId.value = "";
    g.notify("Nave vendida. Créditos adicionados ao saldo.");
  }
}
async function transferCargo() {
  const item = resource.value;
  if (
    item &&
    (await g.stationTransaction((draft) =>
      transferShipCargo(draft, fromId.value, toId.value, item, quantity.value),
    ))
  )
    g.notify("Carga transferida.");
}
</script>
<template>
  <section class="station-form" aria-label="Suas naves">
    <h3>Suas naves</h3>
    <p v-if="!dealership">
      Ao desacoplar, você pilota a nave marcada como Ativa. As outras ficam nos
      hangares indicados, com sua própria carga e melhorias.
    </p>
    <article class="fleet-card">
      <ShipSprite :model="g.state.activeShip.model" />
      <div>
        <h3>{{ g.model.name }} · Ativa</h3>
        <p>{{ location(g.state.systemX, g.state.systemY) }}</p>
        <p>
          Casco {{ Math.floor(g.state.ship.hull) }}/{{ g.model.hull }} ·
          Combustível {{ Math.floor(g.state.ship.fuel) }}/{{ g.maxFuel }} ·
          Carga {{ g.usedSlots }}/{{ g.capacity }}
        </p>
        <p v-if="g.state.upgrades.length">
          Equipamentos:
          {{ g.state.upgrades.map((id) => items[id].name).join(", ") }}
        </p>
      </div>
    </article>
    <article
      v-for="ship in g.state.parkedShips"
      :key="ship.id"
      class="fleet-card"
    >
      <ShipSprite :model="ship.model" />
      <div>
        <h3>{{ shipModels[ship.model].name }} · {{ ship.id }}</h3>
        <p>
          {{ ship.pilot?.trip ? "Hangar de origem: " : ""
          }}{{ location(ship.location.x, ship.location.y) }}
        </p>
        <p>
          Casco {{ Math.floor(ship.ship.hull) }}/{{
            shipModels[ship.model].hull
          }}
          · Combustível {{ Math.floor(ship.ship.fuel) }}/{{
            shipFuelCapacity(ship.model, ship.upgrades)
          }}
          · Carga {{ slots(ship.inventory) }}/{{
            shipCapacity(ship.model, ship.upgrades)
          }}
        </p>
        <p v-if="ship.upgrades.length">
          Equipamentos:
          {{ ship.upgrades.map((id) => items[id].name).join(", ") }}
        </p>
        <div
          v-if="inLocalHangar(g.state, ship) && !ship.pilot"
          class="station-actions"
        >
          <button
            class="primary"
            :disabled="g.trading"
            @click="activate(ship.id)"
          >
            Trocar para esta nave
          </button>
          <template v-if="saleId === ship.id">
            <button
              class="secondary"
              :disabled="g.trading"
              @click="sell(ship.id)"
            >
              Confirmar venda · {{ resalePrice(ship) }} CR
            </button>
            <button class="secondary" @click="saleId = ''">Cancelar</button>
          </template>
          <button
            v-else
            class="secondary"
            :disabled="g.trading || slots(ship.inventory) > 0"
            @click="saleId = ship.id"
          >
            Vender · {{ resalePrice(ship) }} CR
          </button>
        </div>
        <p v-if="inLocalHangar(g.state, ship) && slots(ship.inventory) > 0">
          Transfira a carga antes de vender.
        </p>
        <PilotPanel v-if="!dealership" :ship="ship" />
      </div>
    </article>
    <p v-if="!g.state.parkedShips.length">
      Compre outra nave na concessionária para guardá-la neste hangar.
    </p>
    <form
      v-if="!dealership && localShips.length > 1"
      class="station-form cargo-transfer"
      @submit.prevent="transferCargo"
    >
      <h3>Transferir carga</h3>
      <label for="cargo-source">Nave de origem</label>
      <select id="cargo-source" v-model="fromId">
        <option v-for="ship in localShips" :key="ship.id" :value="ship.id">
          {{ shipModels[ship.model].name }} · {{ ship.id }}
        </option>
      </select>
      <label for="cargo-target">Nave de destino</label>
      <select id="cargo-target" v-model="toId">
        <option
          v-for="ship in localShips.filter((ship) => ship.id !== fromId)"
          :key="ship.id"
          :value="ship.id"
        >
          {{ shipModels[ship.model].name }} · {{ ship.id }}
        </option>
      </select>
      <label for="cargo-resource">Item da carga</label>
      <select
        id="cargo-resource"
        v-model="resource"
        :disabled="!resources.length"
      >
        <option v-if="!resources.length" :value="undefined">
          Nave sem carga
        </option>
        <option v-for="item in resources" :key="item" :value="item">
          {{ items[item].name }} ({{
            localShips.find((ship) => ship.id === fromId)?.inventory[item]
          }})
        </option>
      </select>
      <label for="cargo-amount">Quantidade a transferir</label>
      <input
        id="cargo-amount"
        v-model.number="quantity"
        type="number"
        min="1"
        step="1"
        inputmode="numeric"
      />
      <button class="primary" :disabled="g.trading || !resource">
        Transferir carga
      </button>
    </form>
  </section>
</template>
