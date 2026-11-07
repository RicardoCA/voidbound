<script setup lang="ts">
import { computed, ref } from "vue";
import { useGame } from "../stores/game";
import HangarPanel from "./HangarPanel.vue";
import DealershipPanel from "./DealershipPanel.vue";
import MarketPanel from "./MarketPanel.vue";
const g = useGame();
const section = ref<"market" | "workshop" | "fuel" | "dealer" | "hangar">(
  "market",
);
const fuelAmount = computed(() =>
  Math.max(0, Math.min(20, g.maxFuel - g.state.ship.fuel)),
);
const repairAmount = computed(() =>
  Math.max(0, g.model.hull - g.state.ship.hull),
);
async function service(kind: "fuel" | "hull", amount: number, rate: number) {
  const price = Math.ceil(amount * rate);
  if (amount <= 0) return;
  const success = await g.stationTransaction((draft) => {
    if (draft.credits < price) return "Saldo insuficiente.";
    draft.credits -= price;
    draft.ship[kind] += amount;
  });
  if (success)
    g.notify(kind === "fuel" ? "Abastecimento concluído." : "Casco reparado.");
}
</script>
<template>
  <section class="dialog station-dialog" aria-label="Estação espacial">
    <div class="station-banner">
      <svg
        viewBox="0 0 128 26"
        role="img"
        aria-label="Interior da estação em pixel art"
        shape-rendering="crispEdges"
      >
        <path fill="#172a42" d="M0 0h128v26H0z" />
        <path
          fill="#334f64"
          d="M0 17h128v9H0zM4 0h4v17H4zM120 0h4v17h-4zM14 3h100v2H14z"
        />
        <path fill="#0a1425" d="M16 5h96v11H16z" />
        <path
          fill="#92d6c8"
          d="M21 8h1v1h-1zM38 11h1v1h-1zM62 7h2v1h-2zM92 12h1v1h-1zM104 8h1v1h-1z"
        />
        <path fill="#516c80" d="M52 13h24v6H52zM43 20h42v2H43z" />
        <path fill="#d4b079" d="M2 22h14v1H2zM112 22h14v1h-14z" />
      </svg>
    </div>
    <div class="dialog-heading">
      <div>
        <div class="eyebrow">
          ESTAÇÃO ESPACIAL · SETOR {{ g.system.x }}, {{ g.system.y }}
        </div>
        <h2>{{ g.system.station?.name }}</h2>
      </div>
      <strong class="station-credits"
        >{{ g.state.credits.toLocaleString("pt-BR") }} CR</strong
      >
    </div>
    <nav class="station-actions" aria-label="Serviços da estação">
      <button
        class="secondary"
        :aria-pressed="section === 'market'"
        @click="section = 'market'"
      >
        Mercado
      </button>
      <button
        class="secondary"
        :aria-pressed="section === 'dealer'"
        @click="section = 'dealer'"
      >
        Concessionária
      </button>
      <button
        class="secondary"
        :aria-pressed="section === 'hangar'"
        @click="section = 'hangar'"
      >
        Hangar
      </button>
      <button
        class="secondary"
        :aria-pressed="section === 'workshop'"
        @click="section = 'workshop'"
      >
        Oficina
      </button>
      <button
        class="secondary"
        :aria-pressed="section === 'fuel'"
        @click="section = 'fuel'"
      >
        Abastecimento
      </button>
    </nav>
    <MarketPanel v-if="section === 'market'" />
    <DealershipPanel v-else-if="section === 'dealer'" />
    <HangarPanel v-else-if="section === 'hangar'" />
    <div v-else-if="section === 'workshop'" class="station-form">
      <p>
        Casco: {{ Math.floor(g.state.ship.hull) }}/{{ g.model.hull }}. Reparo a
        3 CR por ponto.
      </p>
      <button
        class="primary"
        :disabled="g.trading || repairAmount <= 0"
        @click="service('hull', repairAmount, 3)"
      >
        Reparar casco · {{ Math.ceil(repairAmount * 3) }} CR
      </button>
      <div class="station-actions">
        <button
          class="secondary"
          :disabled="g.trading"
          @click="g.panel = 'craft'"
        >
          Fabricação
        </button>
        <button
          class="secondary"
          :disabled="g.trading"
          @click="g.panel = 'inventory'"
        >
          Carga e melhorias
        </button>
      </div>
    </div>
    <div v-else class="station-form">
      <p>
        Combustível: {{ Math.floor(g.state.ship.fuel) }}/{{ g.maxFuel }}.
        Abastecimento a 2 CR por unidade.
      </p>
      <button
        class="primary"
        :disabled="g.trading || fuelAmount <= 0"
        @click="service('fuel', fuelAmount, 2)"
      >
        Abastecer {{ fuelAmount.toFixed(1) }} u ·
        {{ Math.ceil(fuelAmount * 2) }} CR
      </button>
    </div>
    <p role="status">{{ g.notice }}</p>
    <button class="secondary" :disabled="g.trading" @click="g.undock">
      Desacoplar
    </button>
  </section>
</template>
