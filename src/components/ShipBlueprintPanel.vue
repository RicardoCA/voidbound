<script setup lang="ts">
import { computed } from "vue";
import {
  buyShipBlueprint,
  craftSpecialShip,
  shipBlueprints,
  type SpecialShip,
} from "../fleet/shipBlueprints";
import { shipModels } from "../fleet/models";
import { items } from "../game/types";
import { inventoryEntries } from "../inventory/inventory";
import { useGame } from "../stores/game";
import ShipSprite from "./ShipSprite.vue";

const g = useGame();
const available = computed(() =>
  (Object.keys(shipBlueprints) as SpecialShip[]).filter(
    (id) => shipBlueprints[id].station === g.system.station?.kind,
  ),
);

async function build(id: SpecialShip) {
  if (await g.stationTransaction((draft) => craftSpecialShip(draft, id)))
    g.notify(`${shipModels[id].name} pronta no hangar desta estação.`);
}
</script>

<template>
  <section v-if="available.length">
    <h3>Projetos de naves especiais</h3>
    <p>
      A oficina usa materiais da carga da nave ativa e entrega a nave montada no
      hangar local.
    </p>
    <article v-for="id in available" :key="id" class="dealer-card">
      <ShipSprite :model="id" />
      <h3>{{ shipModels[id].name }}</h3>
      <p>{{ shipModels[id].role }}</p>
      <ul>
        <li
          v-for="[item, count] in inventoryEntries(
            shipBlueprints[id].materials,
          )"
          :key="item"
        >
          {{ g.state.inventory[item] ?? 0 }}/{{ count }} ·
          {{ items[item].name }}
        </li>
      </ul>
      <button
        v-if="!g.state.shipBlueprints?.includes(id)"
        class="secondary"
        :disabled="g.trading || g.state.credits < shipBlueprints[id].price"
        @click="g.stationTransaction((draft) => buyShipBlueprint(draft, id))"
      >
        Comprar projeto ·
        {{ shipBlueprints[id].price.toLocaleString("pt-BR") }} CR
      </button>
      <button
        v-else
        class="primary"
        :disabled="
          g.trading ||
          inventoryEntries(shipBlueprints[id].materials).some(
            ([item, count]) => (g.state.inventory[item] ?? 0) < count,
          )
        "
        @click="build(id)"
      >
        Fabricar nave
      </button>
    </article>
  </section>
</template>
