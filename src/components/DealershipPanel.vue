<script setup lang="ts">
import { computed, ref } from "vue";
import type { ShipModelId } from "../game/types";
import { items } from "../game/types";
import { useGame } from "../stores/game";
import { shipCategories, shipModels, type ShipCategory } from "../fleet/models";
import { shipBlueprints } from "../fleet/shipBlueprints";
import { buyShip } from "../fleet/hangar";
import ShipSprite from "./ShipSprite.vue";
import HangarPanel from "./HangarPanel.vue";

const g = useGame();
const selected = ref<ShipModelId>();
const category = ref<ShipCategory | "all">("all");
const models = (Object.keys(shipModels) as ShipModelId[]).filter(
  (id) => !Object.hasOwn(shipBlueprints, id),
);
const visibleModels = computed(() =>
  models.filter(
    (id) =>
      category.value === "all" || shipModels[id].category === category.value,
  ),
);
async function buy(model: ShipModelId) {
  if (await g.stationTransaction((draft) => buyShip(draft, model))) {
    selected.value = undefined;
    g.notify(
      `${shipModels[model].name} guardada neste hangar. Você continua pilotando a ${g.model.name}.`,
    );
  }
}
</script>
<template>
  <section class="station-form dealership" aria-label="Modelos de naves">
    <header class="dealership-heading">
      <span class="eyebrow">VITRINE DA ESTAÇÃO</span>
      <h3>Catálogo de frota</h3>
    </header>
    <p>
      A nave comprada fica guardada nesta estação. Você pode comprar um
      cargueiro e continuar explorando com sua nave ativa, a {{ g.model.name }}.
    </p>
    <nav class="station-actions" aria-label="Categorias de naves">
      <button
        class="secondary"
        :aria-pressed="category === 'all'"
        @click="category = 'all'"
      >
        Todas
      </button>
      <button
        v-for="(label, id) in shipCategories"
        :key="id"
        class="secondary"
        :aria-pressed="category === id"
        @click="category = id"
      >
        {{ label }}
      </button>
    </nav>
    <div class="dealership-grid">
      <article v-for="id in visibleModels" :key="id" class="dealer-card">
        <div class="dealer-bay" :data-category="shipModels[id].category">
          <span>{{ shipCategories[shipModels[id].category] }}</span>
          <ShipSprite :model="id" />
        </div>
        <h3>
          {{ shipModels[id].name }}
          <small v-if="g.state.activeShip.model === id"> · Modelo ativo</small>
        </h3>
        <p>{{ shipModels[id].role }}</p>
        <dl class="ship-specs">
          <dt>Carga</dt>
          <dd>{{ shipModels[id].capacity }} slots</dd>
          <dt>Casco</dt>
          <dd>{{ shipModels[id].hull }} pts</dd>
          <dt>Tanque</dt>
          <dd>{{ shipModels[id].fuel }} u</dd>
          <dt>Velocidade</dt>
          <dd>{{ shipModels[id].speed }} km/s</dd>
          <dt>Aceleração</dt>
          <dd>{{ shipModels[id].acceleration }} km/s²</dd>
          <dt>Consumo</dt>
          <dd>{{ shipModels[id].consumption.toLocaleString("pt-BR") }} u/s</dd>
          <dt>Equipamento extra</dt>
          <dd>
            {{
              shipModels[id].equipment
                .map((item) => items[item].name)
                .join(", ") || "—"
            }}
          </dd>
        </dl>
        <div class="station-actions">
          <template v-if="selected === id">
            <button
              class="primary"
              :disabled="g.trading || g.state.credits < shipModels[id].price"
              @click="buy(id)"
            >
              Confirmar · {{ shipModels[id].price.toLocaleString("pt-BR") }} CR
            </button>
            <button class="secondary" @click="selected = undefined">
              Cancelar
            </button>
          </template>
          <button
            v-else
            class="secondary"
            :disabled="g.trading"
            @click="selected = id"
          >
            Comprar · {{ shipModels[id].price.toLocaleString("pt-BR") }} CR
          </button>
        </div>
        <p v-if="g.state.credits < shipModels[id].price">Saldo insuficiente</p>
      </article>
    </div>
  </section>
  <HangarPanel dealership />
</template>
