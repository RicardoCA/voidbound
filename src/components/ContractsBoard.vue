<script setup lang="ts">
import { computed, ref } from "vue";
import { items, type Save } from "../game/types";
import { useGame } from "../stores/game";
import { careerDefinitions } from "../progression/careers";
import {
  acceptContract,
  abandonContract,
  claimContract,
  contractOffers,
  contractStatus,
  type Contract,
} from "../progression/contracts";

const g = useGame();
const tab = ref<"offers" | "history">("offers");
const rows = computed(() => {
  const list =
    tab.value === "offers"
      ? contractOffers(g.state, g.system)
      : Object.values(g.state.progression.contracts).reverse();
  return list.map((contract) => ({
    contract,
    status: contractStatus(g.state, contract),
  }));
});
const statusLabels = {
  AVAILABLE: "Disponível",
  ACTIVE: "Em andamento",
  COMPLETED: "Pronto para entregar",
  FAILED: "Encerrado",
  CLAIMED: "Recompensa recebida",
};
async function apply(
  operation: (state: Save, stationId: string, id: string) => string | undefined,
  contract: Contract,
  message: string,
) {
  if (
    await g.stationTransaction((draft, station) =>
      operation(draft, station, contract.id),
    )
  ) {
    if (operation === acceptContract) tab.value = "history";
    g.notify(message);
  }
}
</script>

<template>
  <section class="station-form" aria-label="Quadro de contratos">
    <h3>Quadro de contratos</h3>
    <nav class="station-actions" aria-label="Filtro de contratos">
      <button
        class="secondary"
        :aria-pressed="tab === 'offers'"
        @click="tab = 'offers'"
      >
        Disponíveis
      </button>
      <button
        class="secondary"
        :aria-pressed="tab === 'history'"
        @click="tab = 'history'"
      >
        Meus contratos
      </button>
    </nav>
    <p v-if="!rows.length">Nenhum contrato nesta lista.</p>
    <article
      v-for="{ contract, status } in rows"
      :key="contract.id"
      class="dealer-card"
    >
      <h3>{{ contract.title }}</h3>
      <p>
        {{ careerDefinitions[contract.career].name }} · Dificuldade
        {{ contract.difficulty }} · {{ statusLabels[status] }}
      </p>
      <p v-if="contract.goal.kind === 'delivery'">
        Entregue {{ contract.goal.quantity }} ×
        {{ items[contract.goal.item].name }}. Na carga ativa:
        {{ g.state.inventory[contract.goal.item] ?? 0 }}.
      </p>
      <p v-else>
        Catalogue {{ contract.goal.name }} pelo scanner ou em um pouso
        planetário.
      </p>
      <p>
        Setor {{ contract.sector.x }}, {{ contract.sector.y }} ·
        {{ contract.credits.toLocaleString("pt-BR") }} CR · {{ contract.xp }} XP
      </p>
      <p
        v-if="
          contract.deadline && (status === 'ACTIVE' || status === 'COMPLETED')
        "
      >
        Prazo restante:
        {{ Math.ceil((contract.deadline - g.state.time) / 60) }} min de jogo
      </p>
      <div class="station-actions">
        <button
          v-if="status === 'AVAILABLE'"
          class="primary"
          :disabled="g.trading"
          @click="apply(acceptContract, contract, 'Contrato aceito.')"
        >
          Aceitar contrato
        </button>
        <template
          v-else-if="
            (status === 'ACTIVE' || status === 'COMPLETED') &&
            contract.stationId === g.system.station?.id
          "
        >
          <button
            v-if="status === 'COMPLETED'"
            class="primary"
            :disabled="g.trading"
            @click="
              apply(
                claimContract,
                contract,
                'Entrega concluída. Recompensa recebida.',
              )
            "
          >
            Entregar e receber
          </button>
          <button
            class="secondary"
            :disabled="g.trading"
            @click="apply(abandonContract, contract, 'Contrato abandonado.')"
          >
            Abandonar
          </button>
        </template>
      </div>
    </article>
  </section>
</template>
